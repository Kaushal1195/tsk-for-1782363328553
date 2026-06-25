import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom'
import { ExpenseProvider } from './context/ExpenseContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ExpenseProvider>
        <App />
      </ExpenseProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
