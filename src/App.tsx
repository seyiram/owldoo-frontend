import { useState } from 'react'

import './App.css'
import ChatInterface from './components/Chat/ChatInterface'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
    <ChatInterface />
    </>
  )
}

export default App
