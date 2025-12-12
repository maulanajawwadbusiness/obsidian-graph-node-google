import React from 'react'
import ReactDOM from 'react-dom/client'
import { GraphPhysicsPlayground } from './playground/GraphPhysicsPlayground'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <GraphPhysicsPlayground />
    </React.StrictMode>,
)
