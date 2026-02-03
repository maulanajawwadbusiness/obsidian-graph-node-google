import React from 'react'
import ReactDOM from 'react-dom/client'
import { GraphPhysicsPlayground } from './playground/GraphPhysicsPlayground'
import './index.css'
import './styles/fonts.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <GraphPhysicsPlayground />
    </React.StrictMode>,
)
