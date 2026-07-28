'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function Storefront() {
  const [activeTab, setActiveTab] = useState('page-goods');
  const [activeBatchName, setActiveBatchName] = useState('SEPTEMBER');
  const [products, setProducts] = useState([]);
  const [userOrders, setUserOrders] = useState([]);
  const [user, setUser] = useState(null);

  const [guestPhone, setGuestPhone] = useState('');
  const [searchedPhone, setSearchedPhone] = useState(false);

  const [selectedSizes, setSelectedSizes] = useState({});
  const [cart, setCart] = useState([]);
  const [depositOption, setDepositOption] = useState('70');

  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');

  const [authMode, setAuthMode] = useState('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authPhoneInput, setAuthPhoneInput] = useState('');

  // 1. Load Paystack Script Automatically & Fetch Local Cart / Session
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    document.body.appendChild(script);

    const savedCart = localStorage.getItem('megadeals_cart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error('Error loading cart', e);
      }
    }

    loadStorefrontData();
    checkCurrentUser();

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('megadeals_cart', JSON.stringify(cart));
  }, [cart]);

  const loadStorefrontData = async () => {
    const { data: batchData } = await supabase
      .from('batches')
      .select('batch_name')
      .eq('is_active', true)
      .single();
    if (batchData) setActiveBatchName(batchData.batch_name);

    const { data: prodData } = await supabase
      .from('products')
      .select('*')
      .order('id', { ascending: false });

    if (prodData) {
      setProducts(prodData);
      const initialSizes = {};
      prodData.forEach((p) => {
        const sizeList = p.sizes ? p.sizes.split(',').map((s) => s.trim()) : ['S', 'M', 'L', 'XL'];
        initialSizes[p.id] = sizeList[0] || 'M';
      });
      setSelectedSizes(initialSizes);
    }
  };

  const checkCurrentUser = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) {
      setUser(currentUser);
      fetchUserOrders(currentUser.email);
    }
  };

  const syncBatchStatus = async (orders) => {
    if (!orders || orders.length === 0) return [];

    const { data: batches } = await supabase.from('batches').select('batch_name, status');
    const batchMap = {};
    if (batches) {
      batches.forEach((b) => {
        batchMap[b.batch_name.toLowerCase()] = b.status;
      });
    }

    return orders.map((ord) => {
      const liveBatchStatus = batchMap[(ord.batch_name || '').toLowerCase()];
      return {
        ...ord,
        batch_status: ord.batch_status || liveBatchStatus || 'Processing',
      };
    });
  };

  const fetchUserOrders = async (email) => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_email', email)
      .order('created_at', { ascending: false });

    if (data) {
      const updated = await syncBatchStatus(data);
      setUserOrders(updated);
    }
  };

  const handleGuestPhoneSearch = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!guestPhone.trim()) return alert('Please enter your phone number');

    const cleanPhone = guestPhone.trim();
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .ilike('customer_phone', `%${cleanPhone}%`)
      .order('created_at', { ascending: false });

    if (error) {
      alert('Error searching orders: ' + error.message);
    } else {
      const updated = await syncBatchStatus(data || []);
      setUserOrders(updated);
      setSearchedPhone(true);
    }
  };

  // Fixed Balance Payment Trigger
  const handlePayBalance = (ord, balance30, deliveryFee, finalTotal) => {
    const paystackKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;

    if (typeof window === 'undefined' || !window.PaystackPop) {
      return alert('Paystack script is loading. Please wait a moment and try again.');
    }

    if (!paystackKey) {
      return alert('Paystack Public Key is missing in environment variables!');
    }

    try {
      const handler = window.PaystackPop.setup({
        key: paystackKey,
        email: ord.customer_email || `${ord.customer_phone || 'customer'}@megadeals.com`,
        amount: Math.round(finalTotal * 100),
        currency: 'GHS',
        ref: `BAL_${ord.id}_${Date.now()}`,
        callback: async function (response) {
          if (response.status === 'success' || response.message === 'Approved') {
            const totalPaidNow = Number(ord.amount_paid || 0) + balance30;
            const { error } = await supabase
              .from('orders')
              .update({
                status: 'Final Payment Received',
                amount_paid: totalPaidNow,
                deposit_percentage: '100',
                payment_reference: response.reference,
              })
              .eq('id', ord.id);

            if (error) {
              alert('Payment received, but failed to update order: ' + error.message);
            } else {
              alert('Payment Successful! Your order is fully paid! ✅');
              if (user) {
                fetchUserOrders(user.email);
              } else if (guestPhone) {
                handleGuestPhoneSearch();
              }
            }
          }
        },
        onClose: function () {
          console.log('Payment popup closed');
        },
      });

      handler.openIframe();
    } catch (err) {
      alert('Paystack Error: ' + err.message);
    }
  };

  const handleSizeSelect = (productId, size) => {
    setSelectedSizes((prev) => ({ ...prev, [productId]: size }));
  };

  const handleAddToCart = (product) => {
    const chosenSize = selectedSizes[product.id] || 'M';
    const newItem = {
      id: product.id,
      title: product.title,
      price: Number(product.price),
      size: chosenSize,
    };
    setCart((prev) => [...prev, newItem]);
    alert(`Added "${product.title}" (Size: ${chosenSize}) to Cart!`);
  };

  const handleRemoveFromCart = (index) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price, 0);
  const paymentAmount = depositOption === '70' ? subtotal * 0.7 : subtotal;

  const handlePaystackCheckout = () => {
    if (cart.length === 0) return alert('Your cart is empty!');
    if (!custName || !custPhone) return alert('Please enter your Name and WhatsApp Phone Number!');

    const paystackKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;

    if (typeof window === 'undefined' || !window.PaystackPop) {
      return alert('Paystack script is still loading. Please try again in a moment.');
    }

    if (!paystackKey) {
      return alert('Paystack Public Key is missing in environment variables!');
    }

    try {
      const handler = window.PaystackPop.setup({
        key: paystackKey,
        email: user ? user.email : `${custPhone}@megadeals.com`,
        amount: Math.round(paymentAmount * 100),
        currency: 'GHS',
        ref: `MGD_${Date.now()}`,
        callback: function (response) {
          if (response.status === 'success' || response.message === 'Approved') {
            const itemSummary = cart.map((i) => `${i.title} (${i.size})`).join(', ');

            supabase
              .from('orders')
              .insert([
                {
                  customer_name: custName,
                  customer_phone: custPhone,
                  customer_email: user ? user.email : '',
                  items: itemSummary,
                  amount_paid: paymentAmount,
                  deposit_percentage: depositOption,
                  batch_name: activeBatchName,
                  batch_status: 'Processing',
                  status: depositOption === '70' ? 'Deposit Paid (70%)' : 'Full Payment (100%)',
                  payment_reference: response.reference,
                },
              ])
              .then(() => {
                setCart([]);
                localStorage.removeItem('megadeals_cart');
                setActiveTab('page-orders');
                if (user) fetchUserOrders(user.email);
              });
          }
        },
        onClose: function () {
          console.log('Payment popup closed');
        },
      });

      handler.openIframe();
    } catch (err) {
      alert('Paystack Error: ' + err.message);
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (authMode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
        options: { data: { phone: authPhoneInput } },
      });
      if (error) alert('Registration Error: ' + error.message);
      else {
        alert('Account registered successfully!');
        setUser(data.user);
        setActiveTab('page-goods');
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });
      if (error) alert('Login Error: ' + error.message);
      else {
        alert('Logged in successfully!');
        setUser(data.user);
        fetchUserOrders(data.user.email);
        setActiveTab('page-goods');
      }
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserOrders([]);
    alert('Logged out');
  };

  return (
    <div style={{ backgroundColor: '#09090b', color: '#f4f4f5', padding: '16px', paddingBottom: '90px', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>

        <header style={{ textAlign: 'center', borderBottom: '1px solid #27272a', paddingBottom: '14px', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', margin: 0 }}>PREORDER STORE</h1>
          <span style={{ display: 'inline-block', background: '#166534', color: '#4ade80', fontSize: '11px', padding: '4px 10px', borderRadius: '20px', marginTop: '6px', fontWeight: 700 }}>
            🟢 {activeBatchName.toUpperCase()} DROP LIVE
          </span>
        </header>

        {/* PAGE 1: GOODS */}
        {activeTab === 'page-goods' && (
          <div>
            <h2 style={{ fontSize: '16px', color: '#fff', marginBottom: '12px' }}>Active Drop Items</h2>

            {products.length === 0 ? (
              <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '16px', padding: '24px', textAlign: 'center', color: '#a1a1aa', fontSize: '13px' }}>
                No drop items available right now. Check back soon!
              </div>
            ) : (
              products.map((p) => {
                const sizesArray = p.sizes ? p.sizes.split(',').map((s) => s.trim()) : ['S', 'M', 'L', 'XL'];
                return (
                  <div key={p.id} style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '16px', overflow: 'hidden', marginBottom: '16px' }}>
                    <img
                      src={p.image_url || 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&q=80'}
                      alt={p.title}
                      style={{ width: '100%', height: '240px', objectFit: 'cover', background: '#27272a' }}
                    />
                    <div style={{ padding: '16px' }}>
                      <div style={{ fontSize: '17px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>{p.title}</div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#38bdf8', marginBottom: '12px' }}>GH₵ {Number(p.price).toFixed(2)}</div>

                      <span style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '6px', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Size</span>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                        {sizesArray.map((size) => {
                          const isSelected = selectedSizes[p.id] === size;
                          return (
                            <button
                              key={size}
                              onClick={() => handleSizeSelect(p.id, size)}
                              style={{
                                flex: 1,
                                padding: '8px 0',
                                background: isSelected ? '#1e3a8a' : '#09090b',
                                border: isSelected ? '1px solid #3b82f6' : '1px solid #3f3f46',
                                color: isSelected ? '#60a5fa' : '#fff',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                textAlign: 'center',
                              }}
                            >
                              {size}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => handleAddToCart(p)}
                        style={{ width: '100%', padding: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}
                      >
                        + Add to Cart
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* PAGE 2: CART */}
        {activeTab === 'page-cart' && (
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
                    <button onClick={() => handleRemoveFromCart(index)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer' }}>
                      Remove
                    </button>
                  </div>
                ))}
                <div style={{ textAlign: 'right', fontWeight: 800, color: '#fff', fontSize: '16px', marginTop: '10px' }}>
                  Subtotal: GH₵ {subtotal.toFixed(2)}
                </div>
              </div>
            )}

            <div style={{ marginTop: '20px', background: '#18181b', padding: '16px', borderRadius: '12px', border: '1px solid #27272a' }}>
              <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '15px', marginBottom: '10px' }}>Payment Deposit Option</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#a1a1aa', marginBottom: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="plan"
                  value="70"
                  checked={depositOption === '70'}
                  onChange={(e) => setDepositOption(e.target.value)}
                />
                Pay 70% Deposit Now (GH₵ {(subtotal * 0.7).toFixed(2)})
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#a1a1aa', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="plan"
                  value="100"
                  checked={depositOption === '100'}
                  onChange={(e) => setDepositOption(e.target.value)}
                />
                Pay 100% Full Amount (GH₵ {subtotal.toFixed(2)})
              </label>

              <input
                type="text"
                placeholder="Full Name"
                value={custName}
                onChange={(e) => setCustName(e.target.value)}
                style={{ width: '100%', padding: '12px', background: '#09090b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '8px', marginTop: '10px', fontSize: '14px', boxSizing: 'border-box' }}
              />
              <input
                type="text"
                placeholder="WhatsApp Phone Number"
                value={custPhone}
                onChange={(e) => setCustPhone(e.target.value)}
                style={{ width: '100%', padding: '12px', background: '#09090b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '8px', marginTop: '10px', fontSize: '14px', boxSizing: 'border-box' }}
              />

              <button
                onClick={handlePaystackCheckout}
                style={{ width: '100%', padding: '14px', background: '#22c55e', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 800, fontSize: '15px', cursor: 'pointer', marginTop: '14px' }}
              >
                Pay GH₵ {paymentAmount.toFixed(2)} via MoMo / Card
              </button>
            </div>
          </div>
        )}

        {/* PAGE 3: ORDERS */}
        {activeTab === 'page-orders' && (
          <div>
            <h2 style={{ fontSize: '16px', color: '#fff', marginBottom: '12px' }}>Track Order & Pay Balance</h2>

            {!user && (
              <div style={{ background: '#18181b', padding: '14px', borderRadius: '12px', border: '1px solid #27272a', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 700, marginBottom: '8px' }}>
                  🔍 Track By Phone Number
                </div>
                <form onSubmit={handleGuestPhoneSearch} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Enter WhatsApp Phone Number"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    style={{ flex: 1, padding: '10px', background: '#09090b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '8px', fontSize: '13px' }}
                  />
                  <button
                    type="submit"
                    style={{ padding: '10px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                  >
                    Check
                  </button>
                </form>
              </div>
            )}

            {userOrders.length === 0 ? (
              <div style={{ background: '#18181b', padding: '14px', borderRadius: '12px', border: '1px solid #27272a', color: '#a1a1aa', fontSize: '12px', textAlign: 'center' }}>
                {searchedPhone ? 'No orders found for this phone number.' : user ? `No previous orders recorded for ${user.email}.` : 'Enter your phone number above or log in to view your orders.'}
              </div>
            ) : (
              userOrders.map((ord) => {
                const depositPaid = Number(ord.amount_paid || 0);
                const isFullyPaid = ord.status === 'Final Payment Received' || ord.status === 'Full Payment (100%)' || ord.deposit_percentage === '100';
                const total100 = ord.total_price ? Number(ord.total_price) : Math.round(depositPaid / 0.7);
                const balance30 = !isFullyPaid ? (total100 - depositPaid) : 0;
                const deliveryFee = 30;
                const finalTotal = balance30 + deliveryFee;

                const isArrived = ord.batch_status === 'Arrived in Ghana' || ord.batch_status === 'Arrived in Ghana 🇬🇭';

                return (
                  <div key={ord.id} style={{ background: '#18181b', padding: '14px', borderRadius: '12px', border: '1px solid #27272a', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '14px' }}>{ord.batch_name || 'Preorder Drop'}</span>
                      <span style={{ background: isFullyPaid ? '#166534' : '#854d0e', color: isFullyPaid ? '#4ade80' : '#fde047', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                        {ord.status || 'Deposit Paid'}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '4px' }}>• {ord.items}</div>
                    <div style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 'bold' }}>
                      Paid So Far: GH₵ {ord.amount_paid} ({ord.deposit_percentage || 70}%)
                    </div>

                    {/* 🇬🇭 ARRIVED IN GHANA — PAYMENT TRIGGER */}
                    {isArrived && !isFullyPaid ? (
                      <div style={{ background: '#1e1b4b', border: '1px solid #4338ca', padding: '12px', borderRadius: '10px', marginTop: '10px' }}>
                        <div style={{ fontSize: '11px', color: '#818cf8', fontWeight: 800, marginBottom: '6px' }}>
                          🇬🇭 YOUR BATCH HAS ARRIVED IN GHANA!
                        </div>
                        <div style={{ fontSize: '12px', color: '#c7d2fe', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span>30% Balance Due:</span>
                          <b>GH₵ {balance30}</b>
                        </div>
                        <div style={{ fontSize: '12px', color: '#c7d2fe', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span>Local Delivery Fee:</span>
                          <b>GH₵ {deliveryFee}</b>
                        </div>
                        <div style={{ fontSize: '13px', color: '#4ade80', fontWeight: 900, display: 'flex', justifyContent: 'space-between', marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed #4338ca' }}>
                          <span>Total Due on Delivery:</span>
                          <span>GH₵ {finalTotal}</span>
                        </div>

                        <button
                          onClick={() => handlePayBalance(ord, balance30, deliveryFee, finalTotal)}
                          style={{ width: '100%', padding: '11px', background: '#22c55e', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 800, fontSize: '13px', marginTop: '10px', cursor: 'pointer' }}
                        >
                          Pay GH₵ {finalTotal} Balance via MoMo / Card 💳
                        </button>
                      </div>
                    ) : isFullyPaid ? (
                      <div style={{ background: '#064e3b', border: '1px solid #059669', color: '#34d399', padding: '8px', borderRadius: '8px', fontSize: '11px', textAlign: 'center', marginTop: '10px', fontWeight: 'bold' }}>
                        ✅ Fully Paid! Ready for dispatch / delivery.
                      </div>
                    ) : (
                      <p style={{ fontSize: '11px', color: '#71717a', fontStyle: 'italic', marginTop: '8px' }}>
                        ⏳ Batch Status: <b>{ord.batch_status || 'Processing'}</b>. Remaining balance trigger will unlock when your batch lands in Ghana.
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* PAGE 4: ACCOUNT */}
        {activeTab === 'page-account' && (
          <div>
            <h2 style={{ fontSize: '16px', color: '#fff', marginBottom: '12px' }}>Customer Account</h2>

            {user ? (
              <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '14px', padding: '20px', textAlign: 'center' }}>
                <p style={{ fontSize: '14px', color: '#fff', marginBottom: '12px' }}>Logged in as: <b>{user.email}</b></p>
                <button
                  onClick={handleSignOut}
                  style={{ width: '100%', padding: '10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '14px', padding: '16px', marginBottom: '16px', textAlign: 'center' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <button
                    onClick={() => setAuthMode('login')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      background: authMode === 'login' ? '#1e3a8a' : '#09090b',
                      border: authMode === 'login' ? '1px solid #3b82f6' : '1px solid #3f3f46',
                      color: authMode === 'login' ? '#60a5fa' : '#a1a1aa',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
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
                      border: authMode === 'signup' ? '1px solid #3b82f6' : '1px solid #3f3f46',
                      color: authMode === 'signup' ? '#60a5fa' : '#a1a1aa',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                    }}
                  >
                    Create Account
                  </button>
                </div>

                <form onSubmit={handleAuthSubmit}>
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    required
                    style={{ width: '100%', padding: '12px', background: '#09090b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '8px', marginBottom: '10px', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    required
                    style={{ width: '100%', padding: '12px', background: '#09090b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '8px', marginBottom: '10px', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                  {authMode === 'signup' && (
                    <input
                      type="text"
                      placeholder="Phone Number"
                      value={authPhoneInput}
                      onChange={(e) => setAuthPhoneInput(e.target.value)}
                      style={{ width: '100%', padding: '12px', background: '#09090b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '8px', marginBottom: '10px', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                  )}

                  <button
                    type="submit"
                    style={{ width: '100%', padding: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', marginTop: '4px' }}
                  >
                    {authMode === 'login' ? 'Sign In' : 'Register Account'}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

      </div>

      {/* BOTTOM NAVIGATION BAR */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#18181b', borderTop: '1px solid #27272a', display: 'flex', justifyContent: 'space-around', padding: '10px 0', zIndex: 100 }}>
        <button
          onClick={() => setActiveTab('page-goods')}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: activeTab === 'page-goods' ? '#38bdf8' : '#71717a', background: 'none', border: 'none', fontSize: '11px', fontWeight: 600, cursor: 'pointer', width: '25%' }}
        >
          <span style={{ fontSize: '18px', marginBottom: '2px' }}>🛍️</span>
          <span>Batch Goods</span>
        </button>

        <button
          onClick={() => setActiveTab('page-cart')}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: activeTab === 'page-cart' ? '#38bdf8' : '#71717a', background: 'none', border: 'none', fontSize: '11px', fontWeight: 600, cursor: 'pointer', width: '25%' }}
        >
          <span style={{ fontSize: '18px', marginBottom: '2px' }}>🛒</span>
          <span>Cart ({cart.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('page-orders')}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: activeTab === 'page-orders' ? '#38bdf8' : '#71717a', background: 'none', border: 'none', fontSize: '11px', fontWeight: 600, cursor: 'pointer', width: '25%' }}
        >
          <span style={{ fontSize: '18px', marginBottom: '2px' }}>📦</span>
          <span>Orders</span>
        </button>

        <button
          onClick={() => setActiveTab('page-account')}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: activeTab === 'page-account' ? '#38bdf8' : '#71717a', background: 'none', border: 'none', fontSize: '11px', fontWeight: 600, cursor: 'pointer', width: '25%' }}
        >
          <span style={{ fontSize: '18px', marginBottom: '2px' }}>👤</span>
          <span>Account</span>
        </button>
      </nav>
    </div>
  );
}
