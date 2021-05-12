# Ember
*[Discontinued]*
Ember was a fully on-chain Dungeon Keeper inspired strategy game built by [lattice.xyz](https://lattice.xyz). 
Building Ember taught us a lot about designing large on-chain applications; and lead to us building [MUD](https://mud.dev); an Ethereum application framework for large on-chain apps.

## Screenshots
![tease](https://user-images.githubusercontent.com/21203499/204538834-aeaa41a7-ac61-4bad-a755-e5a649803920.png)
![CleanShot 2022-04-14 at 13 25 05@2x](https://user-images.githubusercontent.com/21203499/204538907-de40d141-7329-4ffe-bb98-ec2fd5b98189.png)
![Screenshot](https://user-images.githubusercontent.com/108740936/211664859-9f22859b-c99a-470c-9787-c4e39e80fde2.png)

## Video (click to play)
[![Ember Video](https://user-images.githubusercontent.com/21203499/204540070-f13cd455-6530-4529-aedf-7f231f534e80.png)](http://www.youtube.com/watch?v=RmRsxqRRLvE "Ember Video")

## Quickstart

1. Clone the repository
2. Run `yarn` to install everything
3. Run `yarn start` to start a local node and run a local client connected to it

## Deploying

1. Navigate to the `/eth` sub-directory
2. Run `yarn deploy`. You should now see the deploy script CLI
3. Choose options and answer the CLI prompts. You should be able to choose
- The network on which to deploy Ember (one of presets, see [here](./client/src/Backend/ETH/NetworkConfig.ts) for some examples of networks)
- Whether to re-deploy contracts
- Whether to re-deploy client
- Which key to use for Netlify site deployment (if deploying client)
4. Once all the prompts are answered, the deploy script will kick off and deploy either the contracts or the client or both. Once completed without errors, there should be a message printed to stdout with a confirmation and the diamond address / client URL deployed

Note: the configuration for the deploy CLI is stored in the `~/.lattice/config.json` file. Remove or edit this file to re-set the deploy config cache, which will require you to answer some of the prompts in the deploying process again.

## Gameplay

### Feature list

This is a sketch of things that you can do in Ember

- Mine dungeon tiles
- Claim dungeon tiles
- Claim regions
- Build upgrades, e.g. resource generators, lairs
- Find and harvest resources
- Use resources to summon creatures
- Move creatures from/to specific tiles and regions. Use the meta-move feature to strategically plan attacks and defenses
- Build walls to protect dungeon, break walls to attack players
- Fight battles. Attack a player by moving creatures into their regions
- Claim rival dungeons after victory in battle

### Connecting to deployment

For both local gameplay and a deployment on any of the specified chains, you will need a wallet to connect to the game and sign a message authorizing a burner wallet. If utilizing a network with a valid faucet (such as a Lattice Testnet), you don't need any funds prior to gameplay and any funds you require will be dripped to you.

A deployment is identified by two things that the client needs to be aware of

1. The `chainId` (to know which network Ember has been deployed to)
2. The `diamondAddress` (to know where the deployed Ember world is)

So, when joining an Ember game, you should expect the URL to look something like `https://ember.lattice.xyz?chainId=<CHAIN_ID>&diamondAddress=<DEPLOYED_DIAMOND_ADDRESS>`

### Choosing a version

As of repository archival time, there are two stable and deployable branches

1. `master` -- Ember "classic"
2. `ludens/4x` -- Ember "4x" beta version with modified mechanics, additional upgrades, and extra content

Note that if you change branches, make sure to run `yarn` to install everything and re-build before trying to deploy to a chain with `yarn deploy`

## Development

### Using MetaMask

- Use a chrome profile because you will need to create a new metamask account every time you restart your hardhat node (MM caches stuff and gets confused when the nonce drops back to 0)
- You need to add hardhat as a network because the dev bootloader won't do it for you
  - network name: `hardhat`
  - rpc: `http://localhost:8545`
  - chain id: `31337`
  - currency: `ETH`

### Structure of the repository

- `/client`
  - `/src/Backend`: client-side code for interacting with contracts (main file: [GameManager.ts](./client/src/Backend/Game/GameManager.ts))
  - `/src/Frontend`: code for React UI like panels, toolbar, etc. (main file: [Play.tsx](./client/src/Frontend/Pages/Play.tsx))
  - `/src/Renderer`: code for things rendered by Phaser, like the map, creatures, etc. (main file: [mainScene.ts](./client/src/Renderer/scenes/mainScene.ts))
- `/eth`: Contains contract-side code, like game logic and data store

### Partial navigation guide

If you are interested in

- How actions on client are translated to on-chain state changes, check out [GameManager.ts](./client/src/Backend/Game/GameManager.ts), for instance the `harvestTiles()` function or the `claimTiles()` function

- How creature movement works, check out [GameManager.ts](./client/src/Backend/Game/GameManager.ts) and look for `moveCreatures()` and `metaMoveCreatures()` functions. To get an in-depth look into various creature movement logic, check out [CreatureTool.ts](./client/src/Renderer/tools/CreatureTool.ts). The `breakDownMetaMove()` function is a good place to start there

- Roughly how burner wallet impersonation works, check out the `checkImpersonationStatus()` function in [Network.ts](./client/src/Backend/ETH/Network.ts)

- The order in which the client is booted up and what happens at boot-up, check out [AppManager.ts](./client/src/Frontend/AppManager.ts)

- How some of the UI is implemented, decent places to start looking can be the [PlayerCard.tsx](./client/src/Frontend/Components/PlayerCard.tsx) and [Toolbar.tsx](./client/src/Frontend/Components/Toolbar.tsx)

- What the deploy CLI looks like, checkout the [deploy.ts](./eth/cli/tasks/deploy.ts)

## License
GPL-3.0 (see LICENSE)
