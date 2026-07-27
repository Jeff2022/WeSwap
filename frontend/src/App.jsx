import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import UserPage from './pages/User'
import AdminPage from './pages/Admin'
import AdminTools from './pages/AdminTools'

export default function App(){
  return (
    <div>
      <Header />
      <main style={{padding:20}}>
        <Routes>
          <Route path="/" element={<UserPage/>} />
          {/* /admin now opens AdminTools for direct access to admin features */}
          <Route path="/admin" element={<AdminTools/>} />
          <Route path="/admin/tools" element={<AdminTools/>} />
          {/* keep AdminPage available at /admin/page if needed */}
          <Route path="/admin/page" element={<AdminPage/>} />
        </Routes>
      </main>
    </div>
  )
}
