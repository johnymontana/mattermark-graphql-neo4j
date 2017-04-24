let ApolloClient = require('apollo-client'),
    gql          = require('graphql-tag'),
    neo4j        = require('neo4j-driver').v1,
    async        = require('async');

require('es6-promise').polyfill();
require('isomorphic-fetch');


const MATTERMARK_TOKEN = process.env.MATTERMARK_TOKEN || "",
      NEO4J_URI        = process.env.NEO4J_URI || "bolt://localhost:7687",
      NEO4J_USER       = process.env.NEO4J_USER || "neo4j",
      NEO4J_PASSWORD   = process.env.NEO4J_PASSWORD || "neo4j";

// create Neo4j driver instance
let driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));

// create apollo client instance
const networkInterface = ApolloClient.createNetworkInterface({
    uri: 'https://eapi.mattermark.com/graphql',
    opts: {
        headers:
            {
                "Authorization": `Bearer ${MATTERMARK_TOKEN}`
            }
    }
});
const client = new ApolloClient.constructor(networkInterface);


// Cypher queries for inserting company and details
const INSERT_COMPANY_QUERY = `
MERGE (c:Company {id: $company_id})
ON CREATE SET c.name = $company_name
`;


const INSERT_COMPANY_DETAILS_QUERY = `
WITH $organization AS org
MATCH (c:Company {id: org.id})
SET c.estFounded = org.estFounded
WITH *

FOREACH (office IN org.offices | 
  MERGE (city:City {name: office.location.city.name})
  MERGE (c)-[:HAS_OFFICE_IN]->(city)
)

FOREACH (bm IN org.businessModels |
  MERGE (b:BusinessModel {name: bm.name})
  MERGE (c)-[:HAS_BUSINESS_MODEL]->(b)
)

FOREACH (person IN org.personnel |
  MERGE (p:Person {name: person.name})
  MERGE (p)-[r:WORKS_FOR]->(c)
  SET r.title = person.title
)

FOREACH (ind IN org.industries |
  MERGE (i:Industry {name: ind.name})
  MERGE (c)-[:IN_INDUSTRY]->(i)
)

FOREACH (round IN org.fundingRounds |
  CREATE (r:FundingRound {series: round.series})
     SET r.amountRaised = toInteger(round.amountRaised.value)
  MERGE (c)-[:RAISED]->(r)
   FOREACH (investment IN round.investments |
     MERGE (investor:Investor {id: investment.investor.id})
     SET investor.name        = investment.investor.name,
        investor.description = investment.investor.description
     MERGE (investor)-[:PARTICIPATED_IN]->(r)
   )
)

`;


// Mattermark GraphQL API queries
let msfl = {
    "dataset": "companies",
    "filter": {
        "and": [
            {
                "offices.location.state.iso2": "MT"
            },
            {
                "companyPersona.lastFundingAmount.value": {
                    "gte": 0
                }
            }
        ]
    }
};

let getCompaniesByStateQuery = gql`
query getMontanaCompanies($msfl: String) {
    organizationSummaryQuery(msfl: $msfl) {
        organizations {
            edges {
                cursor
                node {
                    id
                    name
                    companyPersona {
                        companyStage
                        lastFundingAmount {
                            value
                            currency
                        }
                        lastFundingDate
                    }
                }
            }
            pageInfo {
                hasNextPage
                hasPreviousPage
            }
            queryId
            totalResults
            currentPage
            pageSize
        }
    }
}
`;

let getCompanyDetailsQuery = gql`
query getCompanyDetails($id: String) {
    organization(id: $id) {
        id
    		name
        businessModels {
          name
        }
		industries {
			name
		}
        estFounded
    		fundingRounds {
          series
          amountRaised{
            value
            transactionDate
            currency
          }
		  fundingDate
          investments {
            amount{
              value
              transactionDate
              currency
            }
            investor{
              id
              name
              description
              personnel {
                name
                title
              }
            }
          }
          amountRaised{
            value
            transactionDate
            currency
            
          }
          
        }
    		domains {
          domain
          alexaRanks {
            weekAgo
          }
          estimatedMonthlyUniques {
            weekAgo
          }
          
        }
    		personnel {
          name
          title
        }
    		offices {
          location {
            name
            city {
              name
            }
            state {
              iso2
            }
            country {
              iso3
            }
            region {
              name
            }
          }
        }
    }
}
`;


// MAIN

// first, find all companies in MT that have a most recent funding round > 0
client.query({
    query: getCompaniesByStateQuery,
    variables: {
        msfl: JSON.stringify(msfl)
    }
})
.then(function(result) {
  console.dir(result);

  let session = driver.session();
  let companies = result.data.organizationSummaryQuery.organizations.edges;

  // collect ids of companies matching the criteria
  let ids = [];

  companies.forEach(function(e){
      console.log(e);
      session.run(INSERT_COMPANY_QUERY, {company_id: e.node.id, company_name: e.node.name})
          .then(function(result) {
              console.log(result);
              //session.close();
          })
          .catch(function(error) {
              console.log(error);
              //session.close();
          });


      ids.push({id: e.node.id, company_name: e.node.name});

  });

  console.log(ids);

  // fetch details for each company, one at a time so as not to swamp the API
  async.mapSeries(ids, fetchCompanyDetails, function(error, results) {
      console.log(error);
      console.log(results);
      console.log("ALL DONE!!");
  })
})
.catch(function(error){
  console.dir(error);
});

// fetch details for a specific company from the Mattermark GraphQL API
function fetchCompanyDetails(id, callback) {

    console.log("FETCHING DETAILS FOR " + id);

    // query the Mattermark GraphQL API
    client.query({
        query: getCompanyDetailsQuery,
        variables: {
            id: id.id
        }
    })
    .then(function(result){
        console.log(result);

        // now write the data to Neo4j
        let session = driver.session();

        session.run(INSERT_COMPANY_DETAILS_QUERY, result.data)
            .then(function(result) {
                console.log(result);
                session.close();

                // pause 1s to stay within rate limit
                setTimeout(callback, 1000);
            })
            .catch(function(error){
                session.close();
                console.log(error);
            })

    })
    .catch(function(error){
        console.log(error);
    })
}