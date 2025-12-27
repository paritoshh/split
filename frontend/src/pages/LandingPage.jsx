/**
 * ===========================================
 * LANDING PAGE
 * ===========================================
 * The first page visitors see.
 * Beautiful, engaging, explains the app.
 * ===========================================
 */

import { Link } from 'react-router-dom'
import { 
  Users, 
  Receipt, 
  Wallet, 
  Sparkles, 
  ArrowRight,
  BadgeIndianRupee,
  Split,
  Shield
} from 'lucide-react'

function LandingPage() {
  return (
    <div className="min-h-screen bg-dark-300 overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Gradient orbs */}
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-primary-500/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-secondary-500/20 rounded-full blur-[120px]" />
        
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzFmMjkzNyIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30" />
      </div>
      
      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center">
            <Split className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-display font-bold text-white">SplitApp</span>
        </Link>
        
        <div className="flex items-center gap-4">
          <Link to="/login" className="text-gray-400 hover:text-white transition-colors font-medium">
            Log in
          </Link>
          <Link to="/register" className="btn-primary">
            Get Started
          </Link>
        </div>
      </nav>
      
      {/* Hero Section */}
      <section className="relative z-10 px-6 pt-20 pb-32 max-w-7xl mx-auto">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-dark-100/50 border border-gray-700 rounded-full px-4 py-2 mb-8 animate-fade-in">
            <Sparkles className="w-4 h-4 text-primary-400" />
            <span className="text-sm text-gray-300">AI-powered expense tracking</span>
          </div>
          
          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-display font-bold mb-6 animate-slide-up">
            <span className="text-white">Split expenses</span>
            <br />
            <span className="gradient-text">effortlessly</span>
          </h1>
          
          {/* Subheadline */}
          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: '0.1s' }}>
            Track shared expenses with friends, roommates, and groups. 
            Know who owes what. Settle up with GPay, PhonePe, or Paytm.
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <Link to="/register" className="btn-primary flex items-center gap-2 text-lg px-8">
              Start Splitting Free
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link to="/login" className="btn-secondary flex items-center gap-2">
              I already have an account
            </Link>
          </div>
        </div>
        
        {/* App Preview */}
        <div className="mt-20 relative animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <div className="bg-gradient-to-b from-dark-100 to-dark-200 rounded-2xl p-8 border border-gray-800 shadow-2xl max-w-4xl mx-auto">
            {/* Mock Dashboard */}
            <div className="grid md:grid-cols-3 gap-6">
              {/* Balance Card */}
              <div className="card">
                <p className="text-gray-400 text-sm mb-1">Total Balance</p>
                <p className="text-3xl font-bold text-green-400">+₹2,450</p>
                <p className="text-sm text-gray-500 mt-2">You are owed</p>
              </div>
              
              {/* Groups Card */}
              <div className="card">
                <p className="text-gray-400 text-sm mb-1">Active Groups</p>
                <p className="text-3xl font-bold text-white">4</p>
                <p className="text-sm text-gray-500 mt-2">Groups you're in</p>
              </div>
              
              {/* Recent Card */}
              <div className="card">
                <p className="text-gray-400 text-sm mb-1">This Month</p>
                <p className="text-3xl font-bold text-primary-400">₹8,500</p>
                <p className="text-sm text-gray-500 mt-2">Total expenses</p>
              </div>
            </div>
            
            {/* Mock Expense List */}
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between p-4 bg-dark-200/50 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">Badminton Court</p>
                    <p className="text-sm text-gray-500">Badminton Squad • Today</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-green-400">+₹900</p>
                  <p className="text-xs text-gray-500">You lent</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-dark-200/50 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">Dinner at Mainland China</p>
                    <p className="text-sm text-gray-500">Weekend Gang • Yesterday</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-red-400">-₹650</p>
                  <p className="text-xs text-gray-500">You owe</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Features Section */}
      <section className="relative z-10 px-6 py-24 bg-dark-200/50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-center mb-4">
            Everything you need to <span className="gradient-text">split smarter</span>
          </h2>
          <p className="text-gray-400 text-center mb-16 max-w-2xl mx-auto">
            Powerful features to make expense sharing simple and stress-free
          </p>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="card group hover:border-primary-500/50">
              <div className="w-14 h-14 bg-primary-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary-500/20 transition-colors">
                <Users className="w-7 h-7 text-primary-400" />
              </div>
              <h3 className="text-xl font-display font-semibold text-white mb-3">
                Group Expenses
              </h3>
              <p className="text-gray-400">
                Create groups for roommates, trips, sports, or any occasion. 
                Track expenses together effortlessly.
              </p>
            </div>
            
            {/* Feature 2 */}
            <div className="card group hover:border-secondary-500/50">
              <div className="w-14 h-14 bg-secondary-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-secondary-500/20 transition-colors">
                <BadgeIndianRupee className="w-7 h-7 text-secondary-400" />
              </div>
              <h3 className="text-xl font-display font-semibold text-white mb-3">
                UPI Payments
              </h3>
              <p className="text-gray-400">
                Settle up instantly with GPay, PhonePe, or Paytm. 
                Generate payment links with one tap.
              </p>
            </div>
            
            {/* Feature 3 */}
            <div className="card group hover:border-purple-500/50">
              <div className="w-14 h-14 bg-purple-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-purple-500/20 transition-colors">
                <Sparkles className="w-7 h-7 text-purple-400" />
              </div>
              <h3 className="text-xl font-display font-semibold text-white mb-3">
                AI-Powered
              </h3>
              <p className="text-gray-400">
                Scan receipts automatically. Smart categorization. 
                Natural language expense entry.
              </p>
            </div>
            
            {/* Feature 4 */}
            <div className="card group hover:border-green-500/50">
              <div className="w-14 h-14 bg-green-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-green-500/20 transition-colors">
                <Split className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="text-xl font-display font-semibold text-white mb-3">
                Flexible Splitting
              </h3>
              <p className="text-gray-400">
                Split equally, by percentages, exact amounts, or shares. 
                You decide how to divide.
              </p>
            </div>
            
            {/* Feature 5 */}
            <div className="card group hover:border-blue-500/50">
              <div className="w-14 h-14 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-500/20 transition-colors">
                <Wallet className="w-7 h-7 text-blue-400" />
              </div>
              <h3 className="text-xl font-display font-semibold text-white mb-3">
                Balance Tracking
              </h3>
              <p className="text-gray-400">
                Always know who owes what. See balances with individuals 
                and across groups at a glance.
              </p>
            </div>
            
            {/* Feature 6 */}
            <div className="card group hover:border-yellow-500/50">
              <div className="w-14 h-14 bg-yellow-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-yellow-500/20 transition-colors">
                <Shield className="w-7 h-7 text-yellow-400" />
              </div>
              <h3 className="text-xl font-display font-semibold text-white mb-3">
                Secure & Private
              </h3>
              <p className="text-gray-400">
                Your financial data is encrypted and secure. 
                We never share your information.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="relative z-10 px-6 py-24">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-6">
            Ready to simplify your <span className="gradient-text">shared expenses</span>?
          </h2>
          <p className="text-gray-400 mb-10 text-lg">
            Join thousands of friends who split smarter. It's free forever.
          </p>
          <Link to="/register" className="btn-primary text-lg px-10 py-4 inline-flex items-center gap-2">
            Create Free Account
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="relative z-10 px-6 py-8 border-t border-gray-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center">
              <Split className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-semibold text-white">SplitApp</span>
          </div>
          
          <p className="text-gray-500 text-sm">
            Made with ❤️ by <a href="http://paritoshagarwal.com" target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline">Paritosh Agarwal</a>
          </p>
          
          <p className="text-gray-500 text-sm">
            © 2024 SplitApp. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage

