// Compatibility launcher: always show the same combined application.
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '../../../../frontend/src/App'
import '../../../../frontend/src/index.css'
import '../../../../frontend/src/bright-theme.css'
import '../../../../frontend/src/workspace.css'

ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)
