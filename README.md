# mattermark-graphql-neo4j

Query the Mattermark GraphQL API using Apollo-Client, saving data into Neo4j.

## Instructions

### Mattermark API Key

You'll need a Mattermark API key. If you don't have one, you can create a trial account [here](http://mattermark.com)

### Neo4j

To import data from the Mattermark API into Neo4j you'll need a Neo4j instance. You can use a local install, or quickly spin up a blank Neo4j Sandbox instance [here](https://neo4j.com/sandbox-v2).

![](img/sandbox_creds.png)
*Note the credentials, needed for the next step*

### Environment variables

Export your api token and neo4j credentials as environmet variables:

```
export MATTERMARK_TOKEN=YOUR_API_TOKEN_HERE
export NEO4J_URI=bolt://HOST_IP_HERE:BOLT_PORT_HERE
export NEO4J_USER=NEO4J_USERNAME_HERE
export NEO4J_PASSWORD=NEO4J_PASSWORD_HERE
```

### Run

1. `npm install`
1. `node index.js`

## Data

By default the script will query for all companies with an office in Montana where the company's last funding round was greater than zero, then run an additional query for each company meeting that criteria to find funding rounds, business models, industries and personnel.

![](img/datamodel.png)
*The Neo4j property graph model, once the data is imported from Mattermark*

## Neo4j Queries

**What investors have participated in more than one Funding Round?**

~~~
// What investors have participated in more than one FundingRound?
MATCH (i:Investor)-[:PARTICIPATED_IN]->(r:FundingRound)<-[:RAISED]-(c:Company)
WHERE size((i)--()) > 1
RETURN *
~~~

![](img/investors.png)


**What companies have raised the most money?**

~~~
// What companies have raised the most money?
MATCH (c:Company)-[:RAISED]->(r:FundingRound)
RETURN c.name, sum(r.amountRaised) as amount
ORDER BY amount DESC
~~~

~~~
╒══════════════════════════╤══════════╕
│"c.name"                  │"amount"  │
╞══════════════════════════╪══════════╡
│"LigoCyte Pharmaceuticals"│"36990335"│
├──────────────────────────┼──────────┤
│"ViZn Energy"             │"33964591"│
├──────────────────────────┼──────────┤
│"RightNow Technologies"   │"31200000"│
├──────────────────────────┼──────────┤
│"Microbion"               │"27178689"│
├──────────────────────────┼──────────┤
│"Osprey Medical"          │"26830000"│
├──────────────────────────┼──────────┤
│"Solum"                   │"23500000"│
├──────────────────────────┼──────────┤
│"ViZn Energy Systems"     │"16800000"│
├──────────────────────────┼──────────┤
│"KE2 Therm Solutions"     │"12006153"│
├──────────────────────────┼──────────┤
│"Schedulicity"            │"7700000" │
├──────────────────────────┼──────────┤
│"Centricient"             │"6500000" │
├──────────────────────────┼──────────┤
│"Swan Valley Medical"     │"5684658" │
├──────────────────────────┼──────────┤
│"ZAF Energy Systems"      │"4059434" │
├──────────────────────────┼──────────┤
│"Clearas Water Recovery"  │"4000000" │
├──────────────────────────┼──────────┤
│"Blackfoot"               │"2500000" │
├──────────────────────────┼──────────┤
│"Rivertop Renewables"     │"2160000" │
├──────────────────────────┼──────────┤
│"Submittable"             │"2090000" │
├──────────────────────────┼──────────┤
│"Goomzee"                 │"1685000" │
├──────────────────────────┼──────────┤
│"TEXbase"                 │"1509025" │
├──────────────────────────┼──────────┤
│"Blue Marble Energy"      │"1300000" │
├──────────────────────────┼──────────┤
│"AlgEvolve"               │"1147396" │
└──────────────────────────┴──────────┘
~~~

See the blog post for more examples.

## TODO

- [ ] handle pagination
- [ ] handle rate limits