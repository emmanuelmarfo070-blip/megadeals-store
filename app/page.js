'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Home() {
  const [activeTab, setActiveTab] = useState('goods'); // 'goods', 'cart', 'orders'
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [phone, setPhone] = useState('');
  const [user, setUser] = useState(null);
  const [userOrders, setUserOrders] = useState([]);
  const [depositPlan, setDepositPlan] = useState(70); // 70% or 100%
  const [activeBatch, setActiveBatch] = useState('Batch 1');

  useEffect(() => {
    fetchProductsAndBatch();
    checkExistingSession();
  }, []);

  const fetchProductsAndBatch = async () => {
    const { data: prodData } = await supabase.from('products').select('*');
    if (prodData) setProducts(prodData);

    const { data: batchData } = await supabase
      .from('batches')
      .select('batch_name')
      .eq('is_active', true)
      .single();
    if (batchData) setActiveBatch(batchData.batch_name);
  };

  const checkExistingSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
      const cleanPhone = session.user.email.split('@')[0];
      setPhone(cleanPhone);
      fetchOrders(cleanPhone, session.user.id);
    }
  };

  const fetchOrders = async (phoneNum, userId) => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .or(`customer_phone.eq.${phoneNum},user_id.eq.${userId}`)
      .order('created_at', { ascending: false });
    if (data) setUserOrders(data);
  };

  const handleAuth = async () => {
    if (!phone || phone.length < 10) return alert('Enter a valid phone number');
    const proxyEmail = `${phone.trim()}@megadeals.store`;
    const defaultPassword = `Megadeals_${phone.trim()}`;

    let { data, error } = await supabase.auth.signInWithPassword({
      email: proxyEmail,
      password: defaultPassword,
    });

    if (error) {
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: proxyEmail,
        password: defaultPassword,
      });

      if (signUpErr) return alert('Auth Error: ' + signUpErr.message);
      data = signUpData;
    }

    if (data?.user) {
      setUser(data.user);
      fetchOrders(phone.trim(), data.user.id);
      alert('Logged in successfully!');
    }
  };

  const rawTotal = cart.reduce((sum, item) => sum + item.price, 0);
  const paymentAmount = depositPlan === 70 ? rawTotal * 0.7 : rawTotal;

  const handleCheckout = () => {
    if (!user) return alert('Please enter your phone number to log in first.');
    if (cart.length === 0) return alert('Cart is empty!');

    const handler = window.PaystackPop.setup({
      key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
      email: `${phone}@megadeals.store`,
      amount: Math.round(paymentAmount * 100),
      currency: 'GHS',
      callback: async (response) => {
        const { error } = await supabase.from('orders').insert([
          {
            user_id: user.id,
            customer_phone: phone,
            items: cart.map((i) => `${i.title} (${i.size})`).join(', '),
            amount_paid: paymentAmount,
            batch_name: activeBatch,
            status: depositPlan === 70 ? 'Deposit Paid (70%)' : 'Full Payment (100%)',
            paystack_ref: response.reference,
          },
        ]);

        if (!error) {
          alert('Pre-order placed successfully!');
          setCart([]);
          fetchOrders(phone, user.id);
          setActiveTab('orders');
        } else {
          alert('Error saving order: ' + error.message);
        }
      },
    });
    handler.openIframe();
  };

  const handlePayBalance = (order, totalDue) => {
    const handler = window.PaystackPop.setup({
      key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
      email: `${order.customer_phone}@megadeals.store`,
      amount: Math.round(totalDue * 100),
      currency: 'GHS',
      callback: async () => {
        await supabase
          .from('orders')
          .update({
            balance_paid: true,
            status: 'Balance Paid - Processing Delivery',
          })
          .eq('id', order.id);

        alert('Balance & Delivery fee paid successfully!');
        fetchOrders(phone, user.id);
      },
    });
    handler.openIframe();
  };

  return (
    <div style={{ background: '#09090b', color: '#fff', minHeight: '100vh', paddingBottom: '70px', fontFamily: 'sans-serif' }}>
      <header style={{ padding: '16px', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#18181b', position: 'sticky', top: 0, zIndex: 10 }}>
        <h1 style={{ fontSize: '18px', fontWeight: '900', margin: 0, color: '#2563eb' }}>MEGADEALS IMPORTS</h1>
        <span style={{ fontSize: '11px', background: '#2563eb22', color: '#60a5fa', padding: '4px 8px', borderRadius: '12px', fontWeight: 'bold' }}>{activeBatch}</span>
      </header>

      {!user && (
        <div style={{ padding: '12px 16px', background: '#18181b', borderBottom: '1px solid #27272a', display: 'flex', gap: '8px' }}>
          <input
            type="tel"
            placeholder="Enter Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ flex: 1, padding: '10px', background: '#09090b', border: '1px solid #3f3f46', borderRadius: '8px', color: '#fff' }}
          />
          <button onClick={handleAuth} style={{ padding: '10px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>
            Login
          </button>
        </div>
      )}

      <main style={{ padding: '16px' }}>
        {activeTab === 'goods' && (
          <div>
            <h2 style={{ fontSize: '16px', marginBottom: '16px' }}>🔥 Active Pre-order Items</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {products.map((item) => (
                <div key={item.id} style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', overflow: 'hidden' }}>
                  <img src={item.image_url} alt={item.title} style={{ width: '100%', height: '140px', objectFit: 'cover' }} />
                  <div style={{ padding: '10px' }}>
                    <h3 style={{ fontSize: '13px', margin: '0 0 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</h3>
                    <p style={{ color: '#4ade80', fontWeight: 'bold', fontSize: '14px', margin: '0 0 8px' }}>GH₵ {item.price}</p>
                    <button
                      onClick={() => setCart([...cart, { ...item, size: 'M' }])}
                      style={{ width: '100%', padding: '8px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px' }}
                    >
                      + Add to Cart
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'cart' && (
          <div>
            <h2 style={{ fontSize: '16px', marginBottom: '16px' }}>🛒 Your Shopping Cart</h2>
            {cart.length === 0 ? <p style={{ color: '#a1a1aa' }}>Your cart is empty.</p> : (
              <div>
                {cart.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#18181b', borderRadius: '8px', marginBottom: '8px', border: '1px solid #27272a' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{item.title}</div>
                      <div style={{ fontSize: '12px', color: '#a1a1aa' }}>GH₵ {item.price}</div>
                    </div>
                    <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 'bold' }}>Remove</button>
                  </div>
                ))}

                <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '14px', margin: '16px 0' }}>
                  <div style={{ fontSize: '12px', color: '#a1a1aa', fontWeight: 'bold', marginBottom: '8px' }}>SELECT PAYMENT PLAN:</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setDepositPlan(70)} style={{ flex: 1, padding: '10px 0', background: depositPlan === 70 ? '#2563eb' : '#09090b', border: `1px solid ${depositPlan === 70 ? '#2563eb' : '#3f3f46'}`, color: '#fff', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px' }}>
                      70% Deposit Now
                    </button>
                    <button onClick={() => setDepositPlan(100)} style={{ flex: 1, padding: '10px 0', background: depositPlan === 100 ? '#2563eb' : '#09090b', border: `1px solid ${depositPlan === 100 ? '#2563eb' : '#3f3f46'}`, color: '#fff', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px' }}>
                      100% Full Payment
                    </button>
                  </div>

                  <div style={{ marginTop: '14px', borderTop: '1px solid #27272a', paddingTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: '800', color: '#4ade80' }}>
                      <span>Due Now ({depositPlan}%):</span>
                      <span>GH₵ {paymentAmount.toFixed(2)}</span>
                    </div>
                    {depositPlan === 70 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#fbbf24', marginTop: '6px' }}>
                        <span>Balance Due on Arrival (30%):</span>
                        <span>GH₵ {(rawTotal * 0.3).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <button onClick={handleCheckout} style={{ width: '100%', padding: '14px', background: '#22c55e', color: '#000', border: 'none', borderRadius: '8px', fontWeight: '900', fontSize: '15px' }}>
                  💳 Pay Deposit GH₵ {paymentAmount.toFixed(2)}
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'orders' && (
          <div>
            <h2 style={{ fontSize: '16px', marginBottom: '16px' }}>📦 Your Pre-order History</h2>
            {!user ? <p style={{ color: '#a1a1aa' }}>Please log in to view your orders.</p> : userOrders.length === 0 ? <p style={{ color: '#a1a1aa' }}>No orders found.</p> : (
              userOrders.map((order) => {
                const remaining30Percent = (order.amount_paid / 0.7) * 0.3;
                const deliveryFee = order.delivery_fee || 0;
                const totalDue = remaining30Percent + deliveryFee;

                return (
                  <div key={order.id} style={{ background: '#18181b', border: '1px solid #27272a', padding: '14px', borderRadius: '12px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: '#a1a1aa' }}>{order.batch_name}</span>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: order.status.includes('Delivered') ? '#4ade80' : '#fbbf24', background: '#27272a', padding: '4px 8px', borderRadius: '6px' }}>
                        {order.status}
                      </span>
                    </div>

                    <h4 style={{ margin: '8px 0 4px', fontSize: '14px', color: '#fff' }}>{order.items}</h4>
                    <p style={{ fontSize: '12px', color: '#a1a1aa', margin: 0 }}>Deposit Paid: GH₵ {order.amount_paid}</p>

                    {order.status === 'Arrived - Balance Due' && !order.balance_paid && (
                      <div style={{ marginTop: '12px', borderTop: '1px dashed #3f3f46', paddingTop: '10px' }}>
                        <div style={{ fontSize: '12px', color: '#e4e4e7', marginBottom: '8px' }}>
                          <div>30% Balance: <b>GH₵ {remaining30Percent.toFixed(2)}</b></div>
                          <div>Delivery Fee: <b>GH₵ {deliveryFee.toFixed(2)}</b></div>
                        </div>
                        <button
                          onClick={() => handlePayBalance(order, totalDue)}
                          style={{ width: '100%', padding: '10px', background: '#22c55e', color: '#000', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer' }}
                        >
                          💳 Pay GH₵ {totalDue.toFixed(2)} (Balance + Delivery)
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>

      <nav style={{ position: 'fixed', bottom: 0, width: '100%', height: '60px', background: '#18181b', borderTop: '1px solid #27272a', display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
        <button onClick={() => setActiveTab('goods')} style={{ background: 'none', border: 'none', color: activeTab === 'goods' ? '#2563eb' : '#a1a1aa', fontWeight: 'bold' }}>🛍️ Goods</button>
        <button onClick={() => setActiveTab('cart')} style={{ background: 'none', border: 'none', color: activeTab === 'cart' ? '#2563eb' : '#a1a1aa', fontWeight: 'bold' }}>🛒 Cart ({cart.length})</button>
        <button onClick={() => setActiveTab('orders')} style={{ background: 'none', border: 'none', color: activeTab === 'orders' ? '#2563eb' : '#a1a1aa', fontWeight: 'bold' }}>📦 Orders</button>
      </nav>
    </div>
  );
}
