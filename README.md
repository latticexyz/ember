# Ember
*[Discontinued]*
Ember was a fully on-chain Dungeon Keeper inspired strategy game built by [https://lattice.xyz](https://lattice.xyz). 
Building Ember taught us a lot about designing large on-chain applications; and lead to us building [MUD](https://mud.dev); an Ethereum application framework for large on-chain apps.
## Screenshots
![tease](https://user-images.githubusercontent.com/21203499/204538834-aeaa41a7-ac61-4bad-a755-e5a649803920.png)
![CleanShot 2022-04-14 at 13 25 05@2x](https://user-images.githubusercontent.com/21203499/204538907-de40d141-7329-4ffe-bb98-ec2fd5b98189.png)
## Video (click to play)
[![Ember Video](https://user-images.githubusercontent.com/21203499/204540070-f13cd455-6530-4529-aedf-7f231f534e80.png)](http://www.youtube.com/watch?v=RmRsxqRRLvE "Ember Video")
## License
GPL-3.0 (see LICENSE)
# How to use
## Using Metamask
- use a chrome profile because you will need to create a new metamask account every time you restart your hardhat node (MM caches stuff and gets confused when the nonce drops back to 0)
- you need to add hardhat as a network because the dev bootloader won't do it for you
  - network name: `hardhat`
  - rpc: `http://localhost:8545`
  - chain id: `31337`
  - currency: `ETH`
## Installation
- `yarn`
