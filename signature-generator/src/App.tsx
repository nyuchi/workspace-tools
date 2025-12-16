import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import Home from './pages/Home'
import GmailAddon from './pages/GmailAddon'
import SignatureGenerator from './pages/SignatureGenerator'
import Setup from './pages/Setup'

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="gmail-addon" element={<GmailAddon />} />
            <Route
              path="signature-generator"
              element={
                <ErrorBoundary>
                  <SignatureGenerator />
                </ErrorBoundary>
              }
            />
            <Route path="setup" element={<Setup />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
