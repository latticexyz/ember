# Minimum Viable Onboarding

## Structure of the repository
- **/client**:
  - /src/Backend: clientside code for interacting with contracts (main file: GameManager.ts)
  - /src/Frontend: code for React UI like panels, toolbar, etc. (main file: Play.tsx)
  - /src/Renderer: code for things rendered by Phaser, like the map, creatures, etc. (main file: mainScene.ts)
- **/eth**: Conains contractside code, like game logic and data store


## Core contribution process
1. Open issue by converting task list item to issue: <img width="961" alt="Screenshot 2021-08-16 at 15 10 25" src="https://user-images.githubusercontent.com/29047312/129568889-0f9b33bb-e029-4e3f-bef0-99120df021d1.png">
2. Create new branch using naming scheme: `contributor/branchname`
3. Code
4. Open PR including short description of changes, add `fixes #ISSUEID` as the first line of the description to automatically link the issue
5. Self-review PR to make sure there are no careless mistakes
6. Request review from 1-2 other contributors
7. Merge PR once there is at least one approval

## General
We're usually hanging muted in the #team voice channel on discord while we're working to be easily reachable in case of any questions.

## Best practices
- Only use `throw new Error()` for things that should never happen and if they do something's wrong. Otherwise use things like `return null` and proper handling thereof.

## FAQ


