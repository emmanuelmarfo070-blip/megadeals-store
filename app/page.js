'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const paystackPublicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Home() {
  const [activeTab, setActiveTab] = useState('goods');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSizes, setSelectedSizes] = useState({});
  const [cart, setCart] = useState([]);
  
  // Checkout & Auth States
  const [depositPlan, setDepositPlan] = useState('70'); // '70' or '100'
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchProducts();
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
      setCustEmail(session.user.email || '');
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase.from('products').select('*');
      if (error) throw error;
      setProducts(data || []);
      
      // Initialize default sizes (S) for each product
      const defaultSizes = {};
      (data || []).forEach(p => { defaultSizes[p.id] = 'S'; });
      setSelectedSizes(defaultSizes);
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSize = (productId, size) => {
    setSelectedSizes(prev => ({ ...prev, [productId]: size }));
  };

  const addToCart = (product) => {
    const chosenSize = selectedSizes[product.id] || 'M';
    setCart(prev => [...prev, { ...product, size: chosenSize }]);
    alert(`Added "${product.title}" (Size: ${chosenSize}) to cart!`);
  };

  const removeFromCart = (index) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + item.price, 0);
  const paymentAmount = depositPlan === '70' ? cartSubtotal * 0.7 : cartSubtotal;

  const handlePaystackCheckout = () => {
    if (cart.length === 0) return alert('Your cart is empty!');
    if (!custName || !custPhone || !custEmail) {
      return alert('Please fill in your Name, Email, and Phone number.');
    }

    if (typeof window.PaystackPop === 'undefined') {
      return alert('Paystack is loading, please try again in a few seconds.');
    }

    const handler = window.PaystackPop.setup({
      key: paystackPublicKey,
      email: custEmail,
      amount: Math.round(paymentAmount * 100), // Amount in pesewas
      currency: 'GHS',
      metadata: {
        custom_fields: [
          { display_name: 'Customer Name', variable_name: 'customer_name', value: custName },
          { display_name: 'Phone Number', variable_name: 'phone_number', value: custPhone },
          { display_name: 'Deposit Plan', variable_name: 'deposit_plan', value: `${depositPlan}%` },
          { display_name: 'Cart Items', variable_name: 'cart_items', value: cart.map(i => `${i.title} (${i.size})`).join(', ') }
        ]
      },
      callback: function (response) {
        alert(`Payment successful! Reference: ${response.reference}`);
        setCart([]);
      },
      onClose: function () {
        alert('Payment cancelled.');
      }
    });

    handler.openIframe();
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    const pass = e.target.authPass.value;
    
    if (authMode === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({ email: custEmail, password: pass });
      if (error) alert(`Login failed: ${error.message}`);
      else {
        setUser(data.user);
        alert('Successfully logged in!');
        setActiveTab('goods');
      }
    } else {
      const { data, error } = await supabase.auth.signUp({ email: custEmail, password: pass });
      if (error) alert(`Signup failed: ${error.message}`);
      else {
        alert('Account registered! Check email or sign in.');
      }
    }
  };

  return (
    <>
      {/* Header */}
      <header style={{ textAlign: 'center', borderBottom: '1px solid #27272a', paddingBottom: '14px', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#fff', letterSpacing: '-0.5px', margin: 0 }}>
          MEGADEALS IMPORTS
        </h1>
        <span style={{ display: 'inline-block', background: '#166534', color: '#4ade80', fontSize: '11px', padding: '4px 10px', borderRadius: '20px', marginTop: '6px', fontWeight: '700' }}>
          🟢 AUGUST DROP LIVE
        </span>
      </header>

      {/* PAGE 1: BATCH GOODS */}
      {activeTab === 'goods' && (
        <div>
          <h2 style={{ fontSize: '16px', color: '#fff', marginBottom: '12px' }}>Active Drop Items</h2>
          {loading ? (
            <p style={{ color: '#a1a1aa' }}>Loading collection...</p>
          ) : products.length === 0 ? (
            <p style={{ color: '#71717a', textAlign: 'center', padding: '20px' }}>No preorders available right now.</p>
          ) : (
            products.map((product) => (
              <div key={product.id} style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '16px', overflow: 'hidden', marginBottom: '16px' }}>
                {product.image_url && (
                  <img src={product.image_url} alt={product.title} style={{ width: '100%', height: '240px', objectFit: 'cover', background: '#27272a' }} />
                )}
                <div style={{ padding: '16px' }}>
                  <div style={{ fontSize: '17px', fontWeight: '700', color: '#fff', marginBottom: '4px' }}>{product.title}</div>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: '#38bdf8', marginBottom: '12px' }}>GH₵ {product.price.toFixed(2)}</div>

                  <span style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '6px', display: 'block', textTransform: 'uppercase', fontWeight: '700' }}>
                    Size
                  </span>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                    {['S', 'M', 'L', 'XL'].map((size) => {
                      const isActive = selectedSizes[product.id] === size;
                      return (
                        <button
                          key={size}
                          onClick={() => handleSelectSize(product.id, size)}
                          style={{
                            flex: 1,
                            padding: '8px 0',
                            background: isActive ? '#1e3a8a' : '#09090b',
                            border: `1px solid ${isActive ? '#3b82f6' : '#3f3f46'}`,
                            color: isActive ? '#60a5fa' : '#fff',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                          }}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => addToCart(product)}
                    style={{ width: '100%', padding: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}
                  >
                    + Add to Cart
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* PAGE 2: CART */}
      {activeTab === 'cart' && (
        <div>
          <h2 style={{ fontSize: '16px', color: '#fff', marginBottom: '12px' }}>Your Preorder Cart</h2>

          {cart.length === 0 ? (
            <p style={{ color: '#71717a', textAlign: 'center', padding: '20px' }}>Your cart is empty.</p>
          ) : (
            <div>
              {cart.map((item, index) => (
                <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#18181b', padding: '12px', borderRadius: '10px', border: '1px solid #27272a', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '14px' }}>{item.title}</div>
                    <div style={{ fontSize: '12px', color: '#38bdf8' }}>GH₵ {item.price.toFixed(2)} | Size: {item.size}</div>
                  </div>
                  <button onClick={() => removeFromCart(index)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer' }}>
                    Remove
                  </button>
                </div>
              ))}

              <div style={{ textAlign: 'right', fontWeight: '800', color: '#fff', fontSize: '16px', marginTop: '10px', marginBottom: '15px' }}>
                Subtotal: GH₵ {cartSubtotal.toFixed(2)}
              </div>

              <div style={{ background: '#18181b', padding: '16px', borderRadius: '12px', border: '1px solid #27272a' }}>
                <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '15px', marginBottom: '10px' }}>Payment Deposit Option</div>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#a1a1aa', marginBottom: '8px', cursor: 'pointer' }}>
                  <input type="radio" name="plan" checked={depositPlan === '70'} onChange={() => setDepositPlan('70')} />
                  Pay 70% Deposit Now (GH₵ {(cartSubtotal * 0.7).toFixed(2)})
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#a1a1aa', marginBottom: '15px', cursor: 'pointer' }}>
                  <input type="radio" name="plan" checked={depositPlan === '100'} onChange={() => setDepositPlan('100')} />
                  Pay 100% Full Amount (GH₵ {cartSubtotal.toFixed(2)})
                </label>

                <input
                  type="text"
                  placeholder="Full Name"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  style={{ width: '100%', padding: '12px', background: '#09090b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '8px', marginBottom: '10px', fontSize: '14px', boxSizing: 'border-box' }}
                />
                <input
                  type="email"
                  placeholder="Email Address"
                  value={custEmail}
                  onChange={(e) => setCustEmail(e.target.value)}
                  style={{ width: '100%', padding: '12px', background: '#09090b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '8px', marginBottom: '10px', fontSize: '14px', boxSizing: 'border-box' }}
                />
                <input
                  type="text"
                  placeholder="WhatsApp Phone Number"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  style={{ width: '100%', padding: '12px', background: '#09090b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
                />

                <button
                  onClick={handlePaystackCheckout}
                  style={{ width: '100%', padding: '14px', background: '#22c55e', color: '#000', border: 'none', borderRadius: '10px', fontWeight: '800', fontSize: '15px', cursor: 'pointer', marginTop: '14px' }}
                >
                  Pay GH₵ {paymentAmount.toFixed(2)} via Paystack
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PAGE 3: PAST ORDERS */}
      {activeTab === 'orders' && (
        <div>
          <h2 style={{ fontSize: '16px', color: '#fff', marginBottom: '12px' }}>My Past Orders</h2>
          
          {!user && (
            <div style={{ background: '#18181b', padding: '16px', borderRadius: '12px', border: '1px solid #27272a', textAlign: 'center', marginBottom: '16px' }}>
              <p style={{ fontSize: '13px', color: '#a1a1aa', marginBottom: '10px' }}>Log in or create an account to track all your batch preorders.</p>
              <button onClick={() => setActiveTab('account')} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                Log In / Register
              </button>
            </div>
          )}

          <div style={{ background: '#18181b', padding: '14px', borderRadius: '12px', border: '1px solid #27272a', marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '14px' }}>August Preorder Drop</span>
              <span style={{ background: '#166534', color: '#4ade80', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>PROCESSING</span>
            </div>
            <div style={{ fontSize: '12px', color: '#a1a1aa' }}>• Order status synced via Supabase</div>
          </div>
        </div>
      )}

      {/* PAGE 4: ACCOUNT / AUTH */}
      {activeTab === 'account' && (
        <div>
          <h2 style={{ fontSize: '16px', color: '#fff', marginBottom: '12px' }}>Customer Account</h2>
          
          {user ? (
            <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '14px', padding: '16px', textAlign: 'center' }}>
              <p style={{ color: '#fff', fontWeight: 'bold', margin: '0 0 10px 0' }}>Logged in as:</p>
              <p style={{ color: '#38bdf8', margin: '0 0 15px 0' }}>{user.email}</p>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  setUser(null);
                  alert('Logged out');
                }}
                style={{ padding: '10px 20px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '14px', padding: '16px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <button
                  onClick={() => setAuthMode('login')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    background: authMode === 'login' ? '#1e3a8a' : '#09090b',
                    border: `1px solid ${authMode === 'login' ? '#3b82f6' : '#3f3f46'}`,
                    color: authMode === 'login' ? '#60a5fa' : '#a1a1aa',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  Sign In
                </button>
                <button
                  onClick={() => setAuthMode('signup')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    background: authMode === 'signup' ? '#1e3a8a' : '#09090b',
                    border: `1px solid ${authMode === 'signup' ? '#3b82f6' : '#3f3f46'}`,
                    color: authMode === 'signup' ? '#60a5fa' : '#a1a1aa',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  Create Account
                </button>
              </div>

              <form onSubmit={handleAuth}>
                <input
                  type="email"
                  placeholder="Email Address"
                  required
                  value={custEmail}
                  onChange={(e) => setCustEmail(e.target.value)}
                  style={{ width: '100%', padding: '12px', background: '#09090b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '8px', marginBottom: '10px', fontSize: '14px', boxSizing: 'border-box' }}
                />
                <input
                  name="authPass"
                  type="password"
                  placeholder="Password"
                  required
                  style={{ width: '100%', padding: '12px', background: '#09090b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '8px', marginBottom: '10px', fontSize: '14px', boxSizing: 'border-box' }}
                />

                <button type="submit" style={{ width: '100%', padding: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', marginTop: '6px' }}>
                  {authMode === 'login' ? 'Sign In' : 'Register Account'}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#18181b', borderTop: '1px solid #27272a', display: 'flex', justifyContent: 'space-around', padding: '10px 0', zIndex: 100 }}>
        {[
          { id: 'goods', icon: '🛍️', label: 'Batch Goods' },
          { id: 'cart', icon: '🛒', label: `Cart (${cart.length})` },
          { id: 'orders', icon: '📦', label: 'Orders' },
          { id: 'account', icon: '👤', label: 'Account' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              color: activeTab === tab.id ? '#38bdf8' : '#71717a',
              background: 'none',
              border: 'none',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
              width: '25%',
            }}
          >
            <span style={{ fontSize: '18px', marginBottom: '2px' }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
