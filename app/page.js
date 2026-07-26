'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const PAYSTACK_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_KEY || '';

export default function Storefront() {
  const [activeTab, setActiveTab] = useState('goods');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Auth State
  const [user, setUser] = useState(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authMsg, setAuthMsg] = useState('');

  // Cart & Checkout States
  const [cart, setCart] = useState([]);
  const [userOrders, setUserOrders] = useState([]);
  const [selectedSizes, setSelectedSizes] = useState({});
  const [depositPlan, setDepositPlan] = useState(70);

  // Customer Contact Details
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');

  useEffect(() => {
    // Check initial auth status
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        fetchUserCart(user.id);
        fetchUserOrders(user.phone || user.email, user.id);
      }
    });

    // Auth Listener
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      if (currentUser) {
        fetchUserCart(currentUser.id);
        fetchUserOrders(currentUser.phone || currentUser.email, currentUser.id);
      } else {
        setCart([]);
        setUserOrders([]);
      }
    });

    fetchProducts();

    return () => authListener.subscription.unsubscribe();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data } = await supabase.from('products').select('*').order('id', { ascending: false });
    if (data) setProducts(data);
    setLoading(false);
  };

  const fetchUserCart = async (userId) => {
    const { data } = await supabase.from('carts').select('*').eq('user_id', userId);
    if (data) setCart(data);
  };

  const fetchUserOrders = async (contactIdentifier, userId) => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .or(`customer_phone.eq.${contactIdentifier},user_id.eq.${userId}`)
      .order('created_at', { ascending: false });
    if (data) setUserOrders(data);
  };

  const handlePhoneAuth = async (e) => {
    e.preventDefault();
    setAuthMsg('Processing...');

    // Format phone number to international standard for Ghana (+233)
    let formattedPhone = phoneInput.trim();
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '+233' + formattedPhone.slice(1);
    }

    if (isSignUp) {
      // Sign Up Flow
      const { data, error } = await supabase.auth.signUp({
        phone: formattedPhone,
        password: passwordInput,
      });
      if (error) {
        setAuthMsg(`Error: ${error.message}`);
      } else {
        setAuthMsg('🎉 Account created! You are now logged in.');
      }
    } else {
      // Log In Flow
      const { data, error } = await supabase.auth.signInWithPassword({
        phone: formattedPhone,
        password: passwordInput,
      });
      if (error) {
        setAuthMsg(`Error: ${error.message}`);
      } else {
        setAuthMsg('✅ Logged in successfully!');
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setCart([]);
    setAuthMsg('');
  };

  const handleSizeSelect = (productId, size) => {
    setSelectedSizes({ ...selectedSizes, [productId]: size });
  };

  const addToCart = async (product) => {
    const size = selectedSizes[product.id] || 'M';
    const itemToAdd = { product_id: product.id, title: product.title, price: product.price, size };

    if (user) {
      // Save directly to Supabase DB for persistent cart
      const { data, error } = await supabase.from('carts').insert([
        { user_id: user.id, ...itemToAdd }
      ]).select();

      if (!error && data) {
        setCart([...cart, data[0]]);
      }
    } else {
      // Temporary state for guests
      setCart([...cart, itemToAdd]);
    }

    alert(`Added ${product.title} (Size: ${size}) to cart!`);
  };

  const removeFromCart = async (index, cartItemId) => {
    if (user && cartItemId) {
      await supabase.from('carts').delete().eq('id', cartItemId);
    }
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  const rawTotal = cart.reduce((sum, item) => sum + Number(item.price), 0);
  const paymentAmount = depositPlan === 70 ? rawTotal * 0.7 : rawTotal;

  // Paystack Trigger Logic
  const handlePaystackCheckout = (e) => {
    e.preventDefault();

    if (cart.length === 0) return alert('Your cart is empty!');
    const phoneToUse = user ? (user.phone || custPhone) : custPhone;
    if (!custName || !phoneToUse) return alert('Please complete your name and WhatsApp number!');

    if (typeof window.PaystackPop === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://js.paystack.co/v1/inline.js';
      script.onload = () => openPaystack(phoneToUse);
      document.body.appendChild(script);
    } else {
      openPaystack(phoneToUse);
    }
  };

  const openPaystack = (phone) => {
    // Generate placeholder email for Paystack API compliance if phone is used
    const paystackEmail = user?.email || `${phone.replace('+', '')}@megadeals.store`;

    const handler = window.PaystackPop.setup({
      key: PAYSTACK_PUBLIC_KEY,
      email: paystackEmail,
      amount: Math.round(paymentAmount * 100),
      currency: 'GHS',
      ref: 'MGD-' + Math.floor(Math.random() * 1000000000 + 1),
      callback: async function (response) {
        // Save complete order to Supabase database
        await supabase.from('orders').insert([
          {
            user_id: user ? user.id : null,
            customer_name: custName,
            customer_email: paystackEmail,
            customer_phone: phone,
            amount_paid: paymentAmount,
            deposit_plan: `${depositPlan}%`,
            items: cart.map((i) => `${i.title} (${i.size})`).join(', '),
            paystack_ref: response.reference,
          },
        ]);

        // Clear cart after checkout
        if (user) {
          await supabase.from('carts').delete().eq('user_id', user.id);
        }
        setCart([]);
        alert(`🎉 Payment Successful! Reference: ${response.reference}`);
        if (user) fetchUserOrders(phone, user.id);
        setActiveTab('orders');
      },
      onClose: function () {
        alert('Transaction cancelled.');
      },
    });

    handler.openIframe();
  };

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '16px', paddingBottom: '90px' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#fff', margin: 0, letterSpacing: '1px' }}>MEGADEALS IMPORTS</h1>
          <p style={{ fontSize: '11px', color: '#38bdf8', margin: 0, fontWeight: 'bold' }}>
            {user ? `Logged in: ${user.phone || 'User'}` : '⚡ Pre-orders Active'}
          </p>
        </div>
      </div>

      {/* 1. GOODS TAB */}
      {activeTab === 'goods' && (
        <div>
          <h2 style={{ fontSize: '14px', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: '12px' }}>Batch Catalog</h2>

          {loading ? (
            <p style={{ color: '#71717a', fontSize: '13px' }}>Loading products...</p>
          ) : products.length === 0 ? (
            <p style={{ color: '#71717a', fontSize: '13px' }}>No items in drop yet.</p>
          ) : (
            products.map((item) => {
              const currentSize = selectedSizes[item.id] || 'M';
              return (
                <div key={item.id} style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '16px', padding: '14px', marginBottom: '16px' }}>
                  <img src={item.image_url} alt={item.title} style={{ width: '100%', height: '220px', objectFit: 'cover', borderRadius: '12px', marginBottom: '12px' }} />
                  <div style={{ fontWeight: '800', fontSize: '16px', color: '#fff', marginBottom: '4px' }}>{item.title}</div>
                  <div style={{ color: '#38bdf8', fontWeight: '800', fontSize: '15px', marginBottom: '12px' }}>GH₵ {Number(item.price).toFixed(2)}</div>

                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '6px', fontWeight: 'bold' }}>SELECT SIZE:</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {['S', 'M', 'L', 'XL'].map((s) => (
                        <button
                          key={s}
                          onClick={() => handleSizeSelect(item.id, s)}
                          style={{
                            flex: 1,
                            padding: '6px 0',
                            background: currentSize === s ? '#2563eb' : '#09090b',
                            border: `1px solid ${currentSize === s ? '#2563eb' : '#3f3f46'}`,
                            color: '#fff',
                            borderRadius: '6px',
                            fontWeight: 'bold',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => addToCart(item)}
                    style={{ width: '100%', padding: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}
                  >
                    + Add to Cart
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 2. CART TAB */}
      {activeTab === 'cart' && (
        <div>
          <h2 style={{ fontSize: '14px', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: '12px' }}>Your Cart ({cart.length})</h2>

          {cart.length === 0 ? (
            <p style={{ color: '#71717a', fontSize: '13px' }}>Your cart is empty.</p>
          ) : (
            <div>
              {cart.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#18181b', border: '1px solid #27272a', padding: '10px 14px', borderRadius: '10px', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '13px' }}>{item.title}</div>
                    <div style={{ fontSize: '11px', color: '#a1a1aa' }}>
                      Size: <b style={{ color: '#fff' }}>{item.size}</b> | GH₵ {Number(item.price).toFixed(2)}
                    </div>
                  </div>
                  <button onClick={() => removeFromCart(idx, item.id)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer' }}>
                    Remove
                  </button>
                </div>
              ))}

              {/* Deposit Plan */}
              <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '14px', margin: '16px 0' }}>
                <div style={{ fontSize: '12px', color: '#a1a1aa', fontWeight: 'bold', marginBottom: '8px' }}>PAYMENT PLAN:</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setDepositPlan(70)} style={{ flex: 1, padding: '10px 0', background: depositPlan === 70 ? '#2563eb' : '#09090b', border: `1px solid ${depositPlan === 70 ? '#2563eb' : '#3f3f46'}`, color: '#fff', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
                    70% Deposit
                  </button>
                  <button onClick={() => setDepositPlan(100)} style={{ flex: 1, padding: '10px 0', background: depositPlan === 100 ? '#2563eb' : '#09090b', border: `1px solid ${depositPlan === 100 ? '#2563eb' : '#3f3f46'}`, color: '#fff', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
                    100% Full Payment
                  </button>
                </div>

                <div style={{ marginTop: '14px', borderTop: '1px solid #27272a', paddingTop: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: '800', color: '#4ade80' }}>
                    <span>Amount Due ({depositPlan}%):</span>
                    <span>GH₵ {paymentAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Checkout Form */}
              <form onSubmit={handlePaystackCheckout} style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '14px' }}>
                <input
                  type="text"
                  placeholder="Full Name"
                  required
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: '#09090b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '8px', marginBottom: '8px', fontSize: '13px', boxSizing: 'border-box' }}
                />
                <input
                  type="tel"
                  placeholder="WhatsApp Phone Number (e.g., 055XXXXXXX)"
                  required
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: '#09090b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '8px', marginBottom: '12px', fontSize: '13px', boxSizing: 'border-box' }}
                />

                <button type="submit" style={{ width: '100%', padding: '14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '900', fontSize: '14px', cursor: 'pointer' }}>
                  Pay GH₵ {paymentAmount.toFixed(2)} via Paystack
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* 3. ORDERS TAB */}
      {activeTab === 'orders' && (
        <div>
          <h2 style={{ fontSize: '14px', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: '12px' }}>Your Past Orders</h2>

          {!user ? (
            <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
              <p style={{ color: '#a1a1aa', fontSize: '12px', marginBottom: '12px' }}>Log in on the Account tab to automatically view your order history.</p>
              <button onClick={() => setActiveTab('account')} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
                Go to Login
              </button>
            </div>
          ) : userOrders.length === 0 ? (
            <p style={{ color: '#71717a', fontSize: '12px' }}>No past orders found for this account.</p>
          ) : (
            userOrders.map((ord) => (
              <div key={ord.id} style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '12px', marginBottom: '10px' }}>
                <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '13px' }}>{ord.items}</div>
                <div style={{ fontSize: '11px', color: '#38bdf8', marginTop: '4px' }}>
                  Paid: GH₵ {parseFloat(ord.amount_paid).toFixed(2)} ({ord.deposit_plan})
                </div>
                <div style={{ fontSize: '10px', color: '#71717a', marginTop: '2px' }}>
                  Ref: {ord.paystack_ref}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 4. ACCOUNT TAB */}
      {activeTab === 'account' && (
        <div>
          <h2 style={{ fontSize: '14px', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: '12px' }}>Customer Account</h2>

          <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '16px' }}>
            {user ? (
              <div>
                <p style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold', marginTop: 0 }}>Welcome back!</p>
                <p style={{ color: '#38bdf8', fontSize: '12px', marginBottom: '16px' }}>{user.phone || 'Logged In Account'}</p>
                <button onClick={handleLogout} style={{ padding: '10px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
                  Log Out
                </button>
              </div>
            ) : (
              <form onSubmit={handlePhoneAuth}>
                <p style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold', marginTop: 0, marginBottom: '6px' }}>
                  {isSignUp ? 'Create an Account' : 'Log In'}
                </p>
                <p style={{ color: '#a1a1aa', fontSize: '12px', marginBottom: '14px' }}>
                  {isSignUp ? 'Sign up with your phone number and password.' : 'Enter your registered phone number and password.'}
                </p>

                <input
                  type="tel"
                  placeholder="Phone Number (e.g., 055XXXXXXX)"
                  required
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: '#09090b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '8px', marginBottom: '10px', fontSize: '13px', boxSizing: 'border-box' }}
                />

                <input
                  type="password"
                  placeholder="Password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: '#09090b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '8px', marginBottom: '12px', fontSize: '13px', boxSizing: 'border-box' }}
                />

                <button type="submit" style={{ width: '100%', padding: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', marginBottom: '12px' }}>
                  {isSignUp ? 'Sign Up' : 'Log In'}
                </button>

                <p
                  onClick={() => { setIsSignUp(!isSignUp); setAuthMsg(''); }}
                  style={{ color: '#38bdf8', fontSize: '12px', textAlign: 'center', cursor: 'pointer', margin: 0, textDecoration: 'underline' }}
                >
                  {isSignUp ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
                </p>

                {authMsg && <p style={{ color: '#38bdf8', fontSize: '12px', marginTop: '12px', marginBottom: 0, textAlign: 'center', fontWeight: 'bold' }}>{authMsg}</p>}
              </form>
            )}
          </div>
        </div>
      )}

      {/* BOTTOM NAVIGATION */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '65px', background: '#09090b', borderTop: '1px solid #27272a', display: 'flex', justifyContent: 'space-around', alignItems: 'center', maxWidth: '480px', margin: '0 auto', zIndex: 100 }}>
        {[
          { id: 'goods', label: 'Goods', icon: '🛍️' },
          { id: 'cart', label: `Cart (${cart.length})`, icon: '🛒' },
          { id: 'orders', label: 'Orders', icon: '📦' },
          { id: 'account', label: user ? 'Account' : 'Login', icon: '👤' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{ background: 'none', border: 'none', color: activeTab === tab.id ? '#38bdf8' : '#71717a', fontSize: '11px', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer' }}
          >
            <span style={{ fontSize: '18px' }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

    </div>
  );
}
