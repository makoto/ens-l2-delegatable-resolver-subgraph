# ENS l2 subgraph

## Setup


## Example queries

```
query{
    domains(first:5){
      id
      context
      resolver{
        addr
      }
      delegates{
        id
      }
    }
    accounts(first:5){
      id
      delegated{
        id
        name
      }
    }
    approvals(first:5){
      id
      name
      context
      blockTimestamp
      blockNumber
    }
  }
  ```
