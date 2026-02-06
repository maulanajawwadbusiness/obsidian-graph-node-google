import React from 'react'
import ReactDOM from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AppShell } from './screens/AppShell'
import { AuthProvider } from './auth/AuthProvider'
import './index.css'
import './styles/fonts.css'

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
const googleLocale =
    typeof navigator !== 'undefined' && navigator.language
        ? navigator.language
        : 'en'
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <GoogleOAuthProvider clientId={googleClientId} locale={googleLocale}>
            <AuthProvider>
                <AppShell />
            </AuthProvider>
        </GoogleOAuthProvider>
    </React.StrictMode>,
)
