# Manual test cases

Run these cases with three Sepolia accounts: payer, freelancer, and arbiter.

| ID | Scenario | Expected result |
| --- | --- | --- |
| M01 | Open the site without MetaMask | A clear wallet-not-found error appears. |
| M02 | Connect while using another network | MetaMask requests a switch to Sepolia. |
| M03 | Create an escrow with valid participants and ETH | MetaMask confirms the transaction and the escrow appears for all three accounts. |
| M04 | Submit an invalid wallet address | The transaction is not sent and a validation message appears. |
| M05 | Payer releases a funded escrow | The freelancer receives the funds and status becomes Released. |
| M06 | Freelancer refunds a funded escrow | The payer receives the funds and status becomes Refunded. |
| M07 | Payer or freelancer raises a dispute | Direct release/refund stops and status becomes Disputed. |
| M08 | Arbiter resolves for freelancer | The freelancer receives the funds and status becomes Released. |
| M09 | Arbiter resolves for payer | The payer receives the funds and status becomes Refunded. |
| M10 | An unrelated wallet attempts a restricted action | The contract rejects the call. |
| M11 | A completed escrow is operated on again | The contract rejects the call. |
| M12 | User rejects a MetaMask request | The page reports cancellation and remains usable. |
