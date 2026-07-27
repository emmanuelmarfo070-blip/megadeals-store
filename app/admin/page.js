'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AdminPage() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMsg, setErrorMsg] = useState(false);

  // Active Tab: 'tab-present' | 'tab-past'
  const [activeTab, setActiveTab] = useState('tab-present');

  // Database States
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeBatch, setActiveBatch] = useState('August');
  const [pastBatches, setPastBatches] = useState([]);

  // Form Inputs
  const [pName, setPName] = useState('');
  const [pPrice, setPPrice] = useState('');
  const [pSizes, setPSizes] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (isUnlocked) {
      loadAdminData();
    }
  }, [isUnlocked]);

  const loadAdminData = async () => {
    // 1. Fetch Orders
    const { data: orderData } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (orderData) setOrders(orderData);

    // 2. Fetch Store Products
    const { data: prodData } = await supabase.from('products').select('*').order('id', { ascending: false });
    if (prodData) setProducts(prodData);

    // 3. Fetch Active Batch Name
    const { data: batchData } = await supabase
      .from('batches')
      .select('batch_name')
      .eq('is_active', true)
      .single();
    if (batchData) setActiveBatch(batchData.batch_name);

    // 4. Fetch Inactive/Past Batches
    const { data: pastBatchData } = await supabase
      .from('batches')
      .select('batch_name')
      .eq('is_active', false);
    if (pastBatchData) setPastBatches(pastBatchData.map(b => b.batch_name));
  };

  const handleUnlock = () => {
    // Uses your passcode
    if (passwordInput === 'Emma$1234' || passwordInput === '1234') {
      setIsUnlocked(true);
      setErrorMsg(false);
    } else {
      setErrorMsg(true);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSaveProduct = async () => {
    if (!pName || !pPrice) return alert('Enter product name and price!');
    if (!imageFile) return alert('Pick a product photo from your gallery!');

    setUploading(true);
    try {
      // 1. Upload photo directly to Supabase Storage bucket 'products'
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const { error: uploadErr } = await supabase.storage
        .from('products')
        .upload(fileName, imageFile);

      if (uploadErr) throw uploadErr;

      // 2. Get Public Image URL
      const { data: urlData } = supabase.storage
        .from('products')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      // 3. Insert Product into database
      const { error: insertErr } = await supabase.from('products').insert([
        {
          title: pName,
          price: parseFloat(pPrice),
          sizes: pSizes || 'S, M, L, XL',
          image_url: publicUrl,
        },
      ]);

      if (insertErr) throw insertErr;

      alert(`Added "${pName}" to Present Batch!`);

      // Reset form
      setPName('');
      setPPrice('');
      setPSizes('');
      setImageFile(null);
      setPhotoPreview('');
      loadAdminData();
    } catch (err) {
      alert('Error saving product: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveProduct = async (id) => {
    if (!confirm('Are you sure you want to remove this item?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (!error) loadAdminData();
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (!error) {
      alert('Order status updated!');
      loadAdminData();
    }
  };

  const handleEndAndStartNewBatch = async () => {
    const nextBatch = prompt('Enter Name for the New Batch (e.g. September Batch):');
    if (!nextBatch) return;

    if (confirm(`End "${activeBatch}" and start "${nextBatch}"? Active store products will be cleared, but past orders remain saved.`)) {
      // Deactivate current batch
      await supabase.from('batches').update({ is_active: false }).neq('id', 0);
      // Create new active batch
      await supabase.from('batches').insert([{ batch_name: nextBatch, is_active: true }]);
      // Clear current store items
      await supabase.from('products').delete().neq('id', 0);

      alert(`Switched to ${nextBatch}!`);
      loadAdminData();
    }
  };

  // 1. UNLOCKED STATE CHECK
  if (!isUnlocked) {
    return (
      <div style={{ backgroundColor: '#09090b', color: '#f4f4f5', padding: '16px', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div style={{ maxWidth: '550px', margin: '0 auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', textAlign: 'center' }}>
            <div style={{ background: '#18181b', border: '1px solid #27272a', padding: '24px', borderRadius: '16px', width: '100%', maxWidth: '360px' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔐</div>
              <h2 style={{ fontSize: '18px', color: '#fff', marginBottom: '4px' }}>Admin Access</h2>
              <p style={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '16px' }}>Enter secret password to access store management</p>

              <input
                type="password"
                className="input-field"
                placeholder="Enter Password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                style={{ width: '100%', padding: '10px 12px', background: '#09090b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '8px', marginBottom: '10px', fontSize: '16px', letterSpacing: '2px', textAlign: 'center', boxSizing: 'border-box' }}
              />
              <button onClick={handleUnlock} style={{ width: '100%', padding: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
                Unlock Dashboard
              </button>
              {errorMsg && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '8px' }}>Incorrect Password!</p>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Filter Present vs Past Orders
  const presentOrders = orders.filter((o) => !o.batch_name || o.batch_name === activeBatch);
  const pastOrders = orders.filter((o) => o.batch_name && o.batch_name !== activeBatch);

  // 2. MAIN ADMIN DASHBOARD
  return (
    <div style={{ backgroundColor: '#09090b', color: '#f4f4f5', padding: '16px', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: '550px', margin: '0 auto' }}>
        
        {/* HEADER BAR */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 800 }}>STORE ADMIN PANEL</h1>
          <button onClick={() => setIsUnlocked(false)} style={{ padding: '6px 12px', background: '#27272a', color: '#ef4444', border: '1px solid #3f3f46', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
            Lock Panel 🔒
          </button>
        </div>

        {/* TOP MODE TOGGLE */}
        <div style={{ display: 'flex', background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '4px', marginBottom: '20px' }}>
          <button
            onClick={() => setActiveTab('tab-present')}
            style={{ flex: 1, padding: '10px 0', background: activeTab === 'tab-present' ? '#2563eb' : 'none', border: 'none', color: activeTab === 'tab-present' ? '#fff' : '#a1a1aa', fontSize: '13px', fontWeight: 700, borderRadius: '8px', cursor: 'pointer', textAlign: 'center' }}
          >
            🟢 Present Batch ({activeBatch})
          </button>
          <button
            onClick={() => setActiveTab('tab-past')}
            style={{ flex: 1, padding: '10px 0', background: activeTab === 'tab-past' ? '#2563eb' : 'none', border: 'none', color: activeTab === 'tab-past' ? '#fff' : '#a1a1aa', fontSize: '13px', fontWeight: 700, borderRadius: '8px', cursor: 'pointer', textAlign: 'center' }}
          >
            📦 Past Orders & Batches
          </button>
        </div>

        {/* ================= 1. PRESENT BATCH TAB ================= */}
        {activeTab === 'tab-present' && (
          <div>
            {/* ADD PRODUCT CARD */}
            <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '14px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  + Add New Goods to {activeBatch} Drop
                </span>
                <button onClick={handleEndAndStartNewBatch} style={{ padding: '4px 8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                  End Batch
                </button>
              </div>

              <input
                type="text"
                placeholder="Product Name (e.g. Graphic Hoodie)"
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', background: '#09090b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '8px', marginBottom: '10px', fontSize: '13px', boxSizing: 'border-box' }}
              />

              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="number"
                  placeholder="Price (GH₵)"
                  value={pPrice}
                  onChange={(e) => setPPrice(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: '#09090b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '8px', marginBottom: '10px', fontSize: '13px', boxSizing: 'border-box' }}
                />
                <input
                  type="text"
                  placeholder="Sizes (S, M, L, XL)"
                  value={pSizes}
                  onChange={(e) => setPSizes(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: '#09090b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '8px', marginBottom: '10px', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              {/* GALLERY PHOTO PICKER */}
              <div style={{ background: '#09090b', border: '1px dashed #3f3f46', padding: '12px', borderRadius: '8px', marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', color: '#a1a1aa', display: 'block', marginBottom: '6px' }}>📷 Pick Product Photo from Gallery:</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ fontSize: '12px', color: '#a1a1aa' }}
                />
                {photoPreview && (
                  <img src={photoPreview} alt="Preview" style={{ width: '50px', height: '50px', borderRadius: '6px', objectFit: 'cover', marginTop: '8px', display: 'block' }} />
                )}
              </div>

              <button
                onClick={handleSaveProduct}
                disabled={uploading}
                style={{ width: '100%', padding: '12px', background: uploading ? '#3f3f46' : '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}
              >
                {uploading ? 'Uploading Photo...' : `+ Save Product to ${activeBatch}`}
              </button>
            </div>

            {/* PRESENT GOODS LIST */}
            <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '14px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>
                Present Batch Goods ({products.length})
              </div>

              {products.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#a1a1aa' }}>No active items posted yet.</div>
              ) : (
                products.map((item) => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#09090b', border: '1px solid #27272a', padding: '10px', borderRadius: '8px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img src={item.image_url} alt={item.title} style={{ width: '42px', height: '42px', borderRadius: '6px', objectFit: 'cover' }} />
                      <div>
                        <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '13px' }}>{item.title}</div>
                        <div style={{ fontSize: '11px', color: '#38bdf8' }}>GH₵ {item.price} | Sizes: {item.sizes || 'S, M, L, XL'}</div>
                      </div>
                    </div>
                    <button onClick={() => handleRemoveProduct(item.id)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer' }}>
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* PRESENT BUYERS & ORDERS */}
            <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '14px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>
                Present Buyers & Orders Received ({presentOrders.length})
              </div>

              {presentOrders.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#a1a1aa' }}>No orders received for this batch yet.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '6px' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #27272a', color: '#a1a1aa' }}>Phone / Item</th>
                      <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #27272a', color: '#a1a1aa' }}>Status</th>
                      <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #27272a', color: '#a1a1aa' }}>Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {presentOrders.map((order) => (
                      <tr key={order.id}>
                        <td style={{ padding: '8px', borderBottom: '1px solid #27272a' }}>
                          <div style={{ fontWeight: 'bold', color: '#fff' }}>{order.customer_phone}</div>
                          <div style={{ fontSize: '10px', color: '#a1a1aa' }}>{order.items}</div>
                        </td>
                        <td style={{ padding: '8px', borderBottom: '1px solid #27272a' }}>
                          <select
                            defaultValue={order.status}
                            onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                            style={{ background: '#09090b', color: '#4ade80', border: '1px solid #3f3f46', borderRadius: '4px', fontSize: '10px', padding: '2px' }}
                          >
                            <option value="Deposit Paid (70%)">70% Deposit</option>
                            <option value="Full Payment (100%)">Full Payment</option>
                            <option value="Ordered from China">In China</option>
                            <option value="In Transit to Ghana">In Transit</option>
                            <option value="Arrived - Balance Due">Arrived (Balance Due)</option>
                            <option value="Out for Delivery">Out for Delivery</option>
                            <option value="Delivered">Delivered</option>
                          </select>
                        </td>
                        <td style={{ padding: '8px', borderBottom: '1px solid #27272a', fontWeight: 'bold', color: '#fff' }}>
                          GH₵ {order.amount_paid}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ================= 2. PAST BATCHES & ORDERS TAB ================= */}
        {activeTab === 'tab-past' && (
          <div>
            {pastBatches.length === 0 && pastOrders.length === 0 ? (
              <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '14px', padding: '16px', fontSize: '12px', color: '#a1a1aa' }}>
                No past closed batches recorded yet.
              </div>
            ) : (
              <div>
                <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '14px', padding: '16px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>
                    Past Orders Archive ({pastOrders.length})
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '6px' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #27272a', color: '#a1a1aa' }}>Buyer / Batch</th>
                        <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #27272a', color: '#a1a1aa' }}>Item</th>
                        <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #27272a', color: '#a1a1aa' }}>Total Paid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pastOrders.map((order) => (
                        <tr key={order.id}>
                          <td style={{ padding: '8px', borderBottom: '1px solid #27272a' }}>
                            <div style={{ fontWeight: 'bold', color: '#fff' }}>{order.customer_phone}</div>
                            <div style={{ fontSize: '10px', color: '#38bdf8' }}>{order.batch_name}</div>
                          </td>
                          <td style={{ padding: '8px', borderBottom: '1px solid #27272a', color: '#a1a1aa' }}>
                            {order.items}
                          </td>
                          <td style={{ padding: '8px', borderBottom: '1px solid #27272a', color: '#4ade80', fontWeight: 'bold' }}>
                            GH₵ {order.amount_paid}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
