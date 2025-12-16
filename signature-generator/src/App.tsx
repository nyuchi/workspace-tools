import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import GmailAddon from './pages/GmailAddon'
import SignatureGenerator from './pages/SignatureGenerator'
import Setup from './pages/Setup'

function App() {
  return (
    <BrowserRouter basename="/workspace-tools">
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="gmail-addon" element={<GmailAddon />} />
          <Route path="signature-generator" element={<SignatureGenerator />} />
          <Route path="setup" element={<Setup />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
