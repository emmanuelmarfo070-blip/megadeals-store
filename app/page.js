'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Public Paystack Key (Replace with your actual pk_live_ or pk_test_ key)
const PAYSTACK_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_KEY || 'pk_test_123456789abcdef';

export default function Storefront() {
  const [activeTab, setActiveTab] = useState('goods'); // 'goods', 'cart', 'orders', 'account'
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Cart & Checkout States
  const [cart, setCart] = useState([]);
  const [selectedSizes, setSelectedSizes] = useState({});
  const [depositPlan, setDepositPlan] = useState(70); // 70 or 100

  // Customer Contact Details
  const [custName, setCustName] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custPhone, setCustPhone] = useState('');

  // Fetch Live Goods from Supabase
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('products').select('*').order('id', { ascending: false });
    if (data) setProducts(data);
    setLoading(false);
  };

  const handleSizeSelect = (productId, size) => {
    setSelectedSizes({ ...selectedSizes, [productId]: size });
  };

  const addToCart = (product) => {
    const size = selectedSizes[product.id] || 'M';
    const itemToAdd = { ...product, size };
    setCart([...cart, itemToAdd]);
    alert(`Added ${product.title} (Size: ${size}) to cart!`);
  };

  const removeFromCart = (index) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  // Pricing calculations
  const rawTotal = cart.reduce((sum, item) => sum + Number(item.price), 0);
  const paymentAmount = depositPlan === 70 ? rawTotal * 0.7 : rawTotal;

  // Paystack Integration
  const handlePaystackCheckout = (e) => {
    e.preventDefault();

    if (cart.length === 0) return alert('Your cart is empty!');
    if (!custName || !custEmail || !custPhone) return alert('Please enter your Name, Email, and Phone Number!');

    // Load Paystack Pop inline script dynamically if not present
    if (typeof window.PaystackPop === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://js.paystack.co/v1/inline.js';
      script.onload = () => triggerPaystackModal();
      document.body.appendChild(script);
    } else {
      triggerPaystackModal();
    }
  };

  const triggerPaystackModal = () => {
    const handler = window.PaystackPop.setup({
      key: PAYSTACK_PUBLIC_KEY,
      email: custEmail,
      amount: Math.round(paymentAmount * 100), // Paystack requires amount in pesewas (GHS * 100)
      currency: 'GHS',
      ref: 'MGD-' + Math.floor(Math.random() * 1000000000 + 1),
      metadata: {
        custom_fields: [
          { display_name: 'Customer Name', variable_name: 'customer_name', value: custName },
          { display_name: 'Phone Number', variable_name: 'phone_number', value: custPhone },
          { display_name: 'Deposit Plan', variable_name: 'deposit_plan', value: `${depositPlan}%` },
        ],
      },
      callback: async function (response) {
        // Save live order record directly into Supabase
        const { error } = await supabase.from('orders').insert([
          {
            customer_name: custName,
            customer_email: custEmail,
            customer_phone: custPhone,
            amount_paid: paymentAmount,
            deposit_plan: `${depositPlan}%`,
            items: cart.map((i) => `${i.title} (${i.size})`).join(', '),
            paystack_ref: response.reference,
          },
        ]);

        if (error) {
          alert('Payment was successful, but saving order failed: ' + error.message);
        } else {
          alert(`🎉 Payment Successful! Order reference: ${response.reference}`);
          setCart([]);
          setActiveTab('orders');
        }
      },
      onClose: function () {
        alert('Transaction cancelled.');
      },
    });

    handler.openIframe();
  };

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '16px', paddingBottom: '90px' }}>
      
      {/* BRAND HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#fff', margin: 0, letterSpacing: '1px' }}>MEGADEALS IMPORTS</h1>
          <p style={{ fontSize: '11px', color: '#38bdf8', margin: 0, fontWeight: 'bold' }}>⚡ Present Batch Pre-orders Active</p>
        </div>
      </div>

      {/* 1. GOODS TAB */}
      {activeTab === 'goods' && (
        <div>
          <h2 style={{ fontSize: '14px', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>
            Batch Catalog
          </h2>

          {loading ? (
            <p style={{ color: '#71717a', fontSize: '13px' }}>Loading products...</p>
          ) : products.length === 0 ? (
            <p style={{ color: '#71717a', fontSize: '13px' }}>No products available in this batch drop yet.</p>
          ) : (
            products.map((item) => {
              const currentSize = selectedSizes[item.id] || 'M';
              return (
                <div
                  key={item.id}
                  style={{
                    background: '#18181b',
                    border: '1px solid #27272a',
                    borderRadius: '16px',
                    padding: '14px',
                    marginBottom: '16px',
                  }}
                >
                  <img
                    src={item.image_url}
                    alt={item.title}
                    style={{ width: '100%', height: '220px', objectFit: 'cover', borderRadius: '12px', marginBottom: '12px' }}
                  />
                  <div style={{ fontWeight: '800', fontSize: '16px', color: '#fff', marginBottom: '4px' }}>{item.title}</div>
                  <div style={{ color: '#38bdf8', fontWeight: '800', fontSize: '15px', marginBottom: '12px' }}>
                    GH₵ {Number(item.price).toFixed(2)}
                  </div>

                  {/* Size Selector */}
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
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: '#2563eb',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: '800',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    + Add to Cart
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 2. CART & CHECKOUT TAB */}
      {activeTab === 'cart' && (
        <div>
          <h2 style={{ fontSize: '14px', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>
            Your Cart ({cart.length})
          </h2>

          {cart.length === 0 ? (
            <p style={{ color: '#71717a', fontSize: '13px' }}>Your cart is empty.</p>
          ) : (
            <div>
              {cart.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'space-between',
                    background: '#18181b',
                    border: '1px solid #27272a',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    marginBottom: '8px',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '13px' }}>{item.title}</div>
                    <div style={{ fontSize: '11px', color: '#a1a1aa' }}>
                      Size: <b style={{ color: '#fff' }}>{item.size}</b> | GH₵ {Number(item.price).toFixed(2)}
                    </div>
                  </div>
                  <button
                    onClick={() => removeFromCart(idx)}
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                </div>
              ))}

              {/* Deposit Plan Selector */}
              <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '14px', margin: '16px 0' }}>
                <div style={{ fontSize: '12px', color: '#a1a1aa', fontWeight: 'bold', marginBottom: '8px' }}>PAYMENT PLAN:</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setDepositPlan(70)}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      background: depositPlan === 70 ? '#2563eb' : '#09090b',
                      border: `1px solid ${depositPlan === 70 ? '#2563eb' : '#3f3f46'}`,
                      color: '#fff',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    70% Deposit
                  </button>
                  <button
                    onClick={() => setDepositPlan(100)}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      background: depositPlan === 100 ? '#2563eb' : '#09090b',
                      border: `1px solid ${depositPlan === 100 ? '#2563eb' : '#3f3f46'}`,
                      color: '#fff',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    100% Full Payment
                  </button>
                </div>

                <div style={{ marginTop: '14px', borderTop: '1px solid #27272a', paddingTop: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#a1a1aa', marginBottom: '4px' }}>
                    <span>Total Batch Value:</span>
                    <span>GH₵ {rawTotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: '800', color: '#4ade80' }}>
                    <span>Amount Due Now ({depositPlan}%):</span>
                    <span>GH₵ {paymentAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Customer Contact Details */}
              <form onSubmit={handlePaystackCheckout} style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '14px' }}>
                <div style={{ fontSize: '12px', color: '#a1a1aa', fontWeight: 'bold', marginBottom: '10px' }}>YOUR DETAILS:</div>
                <input
                  type="text"
                  placeholder="Full Name"
                  required
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: '#09090b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '8px', marginBottom: '8px', fontSize: '13px', boxSizing: 'border-box' }}
                />
                <input
                  type="email"
                  placeholder="Email Address"
                  required
                  value={custEmail}
                  onChange={(e) => setCustEmail(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: '#09090b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '8px', marginBottom: '8px', fontSize: '13px', boxSizing: 'border-box' }}
                />
                <input
                  type="tel"
                  placeholder="WhatsApp Phone Number"
                  required
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: '#09090b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '8px', marginBottom: '12px', fontSize: '13px', boxSizing: 'border-box' }}
                />

                <button
                  type="submit"
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: '#16a34a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '900',
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
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
          <h2 style={{ fontSize: '14px', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>
            Your Placed Orders
          </h2>
          <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
            <p style={{ color: '#a1a1aa', fontSize: '13px', margin: 0 }}>
              Orders are linked to your phone number and email upon checkout payment.
            </p>
          </div>
        </div>
      )}

      {/* 4. ACCOUNT TAB */}
      {activeTab === 'account' && (
        <div>
          <h2 style={{ fontSize: '14px', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>
            Megadeals Account
          </h2>
          <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '16px' }}>
            <p style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold', marginTop: 0 }}>Megadeals Imports Customer Portal</p>
            <p style={{ color: '#a1a1aa', fontSize: '12px', margin: 0 }}>For support or direct pre-order inquiries, message us on WhatsApp.</p>
          </div>
        </div>
      )}

      {/* BOTTOM 4-TAB NAVIGATION BAR */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '65px',
          background: '#09090b',
          borderTop: '1px solid #27272a',
          display: 'flex',
          justify: 'space-around',
          alignItems: 'center',
          maxWidth: '480px',
          margin: '0 auto',
          zIndex: 100,
        }}
      >
        {[
          { id: 'goods', label: 'Goods', icon: '🛍️' },
          { id: 'cart', label: `Cart (${cart.length})`, icon: '🛒' },
          { id: 'orders', label: 'Orders', icon: '📦' },
          { id: 'account', label: 'Account', icon: '👤' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === tab.id ? '#38bdf8' : '#71717a',
              fontSize: '11px',
              fontWeight: 'bold',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: '18px' }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

    </div>
  );
}
