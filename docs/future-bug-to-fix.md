# Future Bugs to Fix

## High Priority

- [ ] **Crash with N=4 Nodes**:
    - **Description**: Setting `spawnCount` to 4 causes a crash: `Uncaught TypeError: Cannot read properties of undefined (reading 'x')`.
    - **Location**: `generateRandomGraph` in `src/playground/graphRandom.ts` (line ~291).
    - **Context**: User reported this occurs when setting `const [spawnCount, setSpawnCount] = useState(4);` in `GraphPhysicsPlayground.tsx`.
    - **Screenshot**: ![Bug Screenshot](/Users/maulana/.gemini/antigravity/brain/3327d74e-910a-4bfe-97d1-470234c2df95/uploaded_image_1770063157307.png)

