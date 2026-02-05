import React from 'react'
import ReactDOM from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { GraphPhysicsPlayground } from './playground/GraphPhysicsPlayground'
import { AuthProvider } from './auth/AuthProvider'
import './index.css'
import './styles/fonts.css'

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
const googleLocale =
    typeof navigator !== 'undefined' && navigator.language
        ? navigator.language
        : 'en'
console.log('[auth] VITE_GOOGLE_CLIENT_ID', googleClientId)

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <GoogleOAuthProvider clientId={googleClientId} locale={googleLocale}>
            <AuthProvider>
                <GraphPhysicsPlayground />
            </AuthProvider>
        </GoogleOAuthProvider>
    </React.StrictMode>,
)
