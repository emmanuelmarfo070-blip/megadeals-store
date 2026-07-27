'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AdminPanel() {
  // Passcode Security
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState('');

  // Admin View Tab
  const [adminTab, setAdminTab] = useState('present'); // 'present' | 'past'

  // Data States
  const [activeBatch, setActiveBatch] = useState(null);
  const [products, setProducts] = useState([]);
  const [currentOrders, setCurrentOrders] = useState([]);
  const [allBatches, setAllBatches] = useState([]);
  const [pastOrders, setPastOrders] = useState([]);
  const [selectedPastBatch, setSelectedPastBatch] = useState(null);

  // New Product Form
  const [newTitle, setNewTitle] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newSizes, setNewSizes] = useState('S, M, L, XL');
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // New Batch Form
  const [newBatchName, setNewBatchName] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      loadAdminData();
    }
  }, [isAuthenticated]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (passcode === '1234') { // Change to your preferred admin passcode
      setIsAuthenticated(true);
    } else {
      alert('Incorrect passcode!');
    }
  };

  const loadAdminData = async () => {
    // 1. Fetch Active Batch
    const { data: batchData } = await supabase
      .from('batches')
      .select('*')
      .eq('is_active', true)
      .single();

    if (batchData) {
      setActiveBatch(batchData);

      // Fetch products for active batch
      const { data: prodData } = await supabase
        .from('products')
        .select('*')
        .order('id', { ascending: false });
      if (prodData) setProducts(prodData);

      // Fetch ACTIVE orders for current batch
      const { data: ordData } = await supabase
        .from('orders')
        .select('*')
        .eq('batch_name', batchData.batch_name)
        .order('created_at', { ascending: false });
      if (ordData) setCurrentOrders(ordData);
    } else {
      setActiveBatch(null);
      setProducts([]);
      setCurrentOrders([]);
    }

    // 2. Fetch All Batches (for Past Batches tab)
    const { data: batchList } = await supabase
      .from('batches')
      .select('*')
      .order('created_at', { ascending: false });
    if (batchList) setAllBatches(batchList);

    // 3. Fetch All Orders
    const { data: allOrd } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (allOrd) setPastOrders(allOrd);
  };

  // Add Product to Current Batch
  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!newTitle || !newPrice) return alert('Fill in title and price');
    if (!activeBatch) return alert('No active batch found! Create a new batch first.');

    setUploading(true);
    let imageUrl = '';

    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, imageFile);

      if (uploadError) {
        alert('Image upload failed: ' + uploadError.message);
        setUploading(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);
      imageUrl = publicUrlData.publicUrl;
    }

    const { error } = await supabase.from('products').insert([
      {
        title: newTitle,
        price: parseFloat(newPrice),
        sizes: newSizes,
        image_url: imageUrl,
        batch_id: activeBatch.id,
      },
    ]);

    setUploading(false);

    if (error) {
      alert('Error adding product: ' + error.message);
    } else {
      alert('Product added successfully!');
      setNewTitle('');
      setNewPrice('');
      setImageFile(null);
      loadAdminData();
    }
  };

  // Remove Product
  const handleRemoveProduct = async (id) => {
    if (!confirm('Remove this product?')) return;
    await supabase.from('products').delete().eq('id', id);
    loadAdminData();
  };

  // End Active Batch
  const handleEndBatch = async () => {
    if (!activeBatch) return;
    if (!confirm(`Are you sure you want to end "${activeBatch.batch_name}"? This will archive present orders.`)) return;

    await supabase.from('batches').update({ is_active: false }).eq('id', activeBatch.id);
    alert(`Batch "${activeBatch.batch_name}" closed!`);
    loadAdminData();
  };

  // Create New Active Batch
  const handleCreateBatch = async (e) => {
    e.preventDefault();
    if (!newBatchName) return alert('Enter a batch name!');

    await supabase.from('batches').update({ is_active: false }).eq('is_active', true);

    const { error } = await supabase.from('batches').insert([
      { batch_name: newBatchName, is_active: true }
    ]);

    if (error) {
      alert('Error creating batch: ' + error.message);
    } else {
      alert(`New active drop "${newBatchName}" created!`);
      setNewBatchName('');
      loadAdminData();
    }
  };

  // Delete Individual Order
  const handleDeleteOrder = async (orderId) => {
    if (!confirm('Are you sure you want to delete this order?')) return;

    const { error } = await supabase.from('orders').delete().eq('id', orderId);
    if (error) {
      alert('Error deleting order: ' + error.message);
    } else {
      alert('Order deleted successfully!');
      loadAdminData();
    }
  };

  // Delete Batch
  const handleDeleteBatch = async (batchId, batchName) => {
    if (!confirm(`Delete batch "${batchName}"? This does not delete customer orders associated with it.`)) return;

    const { error } = await supabase.from('batches').delete().eq('id', batchId);
    if (error) {
      alert('Error deleting batch: ' + error.message);
    } else {
      alert('Batch deleted!');
      if (selectedPastBatch === batchName) setSelectedPastBatch(null);
      loadAdminData();
    }
  };

  if (!isAuthenticated) {
    return (
      <div style={{ background: '#09090b', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'sans-serif' }}>
        <form onSubmit={handleLogin} style={{ background: '#18181b', border: '1px solid #27272a', padding: '24px', borderRadius: '16px', width: '300px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px' }}>ADMIN ACCESS</h2>
          <input
            type="password"
            placeholder="Enter Admin Passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            style={{ width: '100%', padding: '12px', background: '#09090b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '8px', marginBottom: '14px', boxSizing: 'border-box', textAlign: 'center' }}
          />
          <button type="submit" style={{ width: '100%', padding: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>
            Unlock Panel
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#09090b', color: '#f4f4f5', padding: '16px', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>

        {/* HEADER */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 900 }}>STORE ADMIN PANEL</h1>
          <button onClick={() => setIsAuthenticated(false)} style={{ background: '#27272a', border: 'none', color: '#a1a1aa', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
            Lock Panel 🔒
          </button>
        </header>

        {/* TAB SWITCHER */}
        <div style={{ display: 'flex', gap: '8px', background: '#18181b', padding: '4px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #27272a' }}>
          <button
            onClick={() => setAdminTab('present')}
            style={{
              flex: 1,
              padding: '10px',
              background: adminTab === 'present' ? '#2563eb' : 'transparent',
              color: adminTab === 'present' ? '#fff' : '#a1a1aa',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            🟢 Present Batch ({activeBatch ? activeBatch.batch_name : 'None'})
          </button>
          <button
            onClick={() => setAdminTab('past')}
            style={{
              flex: 1,
              padding: '10px',
              background: adminTab === 'past' ? '#2563eb' : 'transparent',
              color: adminTab === 'past' ? '#fff' : '#a1a1aa',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            📦 Past Orders & Batches
          </button>
        </div>

        {/* ================= TAB 1: PRESENT BATCH ================= */}
        {adminTab === 'present' && (
          <div>
            {!activeBatch ? (
              <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '15px', color: '#fff', marginBottom: '10px' }}>Start New Preorder Batch</h3>
                <form onSubmit={handleCreateBatch}>
                  <input
                    type="text"
                    placeholder="Batch Name (e.g. AUGUST DROP)"
                    value={newBatchName}
                    onChange={(e) => setNewBatchName(e.target.value)}
                    style={{ width: '100%', padding: '12px', background: '#09090b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '8px', marginBottom: '10px', boxSizing: 'border-box' }}
                  />
                  <button type="submit" style={{ width: '100%', padding: '12px', background: '#22c55e', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer' }}>
                    + Start Active Drop
                  </button>
                </form>
              </div>
            ) : (
              <div>
                {/* ADD GOODS CARD */}
                <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#38bdf8' }}>+ ADD NEW GOODS TO {activeBatch.batch_name.toUpperCase()}</span>
                    <button onClick={handleEndBatch} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                      End Batch
                    </button>
                  </div>

                  <form onSubmit={handleAddProduct}>
                    <input
                      type="text"
                      placeholder="Product Name (e.g. Graphic Hoodie)"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      style={{ width: '100%', padding: '12px', background: '#09090b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '8px', marginBottom: '10px', boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                      <input
                        type="number"
                        placeholder="Price (GH₵)"
                        value={newPrice}
                        onChange={(e) => setNewPrice(e.target.value)}
                        style={{ flex: 1, padding: '12px', background: '#09090b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '8px', boxSizing: 'border-box' }}
                      />
                      <input
                        type="text"
                        placeholder="Sizes (S, M, L, XL)"
                        value={newSizes}
                        onChange={(e) => setNewSizes(e.target.value)}
                        style={{ flex: 1, padding: '12px', background: '#09090b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '8px', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div style={{ background: '#09090b', border: '1px dashed #3f3f46', padding: '12px', borderRadius: '8px', marginBottom: '12px', textAlign: 'center' }}>
                      <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} style={{ color: '#a1a1aa', fontSize: '12px' }} />
                    </div>

                    <button
                      type="submit"
                      disabled={uploading}
                      style={{ width: '100%', padding: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      {uploading ? 'Uploading Product...' : `+ Save Product to ${activeBatch.batch_name}`}
                    </button>
                  </form>
                </div>

                {/* PRESENT GOODS LIST */}
                <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#38bdf8', marginBottom: '12px' }}>
                    PRESENT BATCH GOODS ({products.length})
                  </h3>
                  {products.length === 0 ? (
                    <p style={{ fontSize: '12px', color: '#71717a' }}>No products added to this active batch yet.</p>
                  ) : (
                    products.map((p) => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#09090b', border: '1px solid #27272a', padding: '10px', borderRadius: '10px', marginBottom: '8px' }}>
                        <img src={p.image_url || 'https://via.placeholder.com/60'} alt="" style={{ width: '50px', height: '50px', borderRadius: '6px', objectFit: 'cover' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#fff' }}>{p.title}</div>
                          <div style={{ fontSize: '12px', color: '#38bdf8' }}>GH₵ {p.price} | Sizes: {p.sizes}</div>
                        </div>
                        <button onClick={() => handleRemoveProduct(p.id)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer' }}>
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* PRESENT BUYERS & ORDERS */}
                <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '16px', padding: '16px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#38bdf8', marginBottom: '12px' }}>
                    PRESENT BUYERS & ORDERS RECEIVED ({currentOrders.length})
                  </h3>

                  {currentOrders.length === 0 ? (
                    <p style={{ fontSize: '12px', color: '#71717a' }}>No orders received for this active batch yet.</p>
                  ) : (
                    currentOrders.map((ord) => (
                      <div key={ord.id} style={{ background: '#09090b', border: '1px solid #27272a', padding: '12px', borderRadius: '10px', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '13px' }}>{ord.customer_name} ({ord.customer_phone})</span>
                          <span style={{ color: '#4ade80', fontWeight: 'bold', fontSize: '13px' }}>GH₵ {ord.amount_paid}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#a1a1aa' }}>Item: {ord.items}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                          <span style={{ fontSize: '11px', color: '#60a5fa' }}>Status: {ord.status}</span>
                          <button onClick={() => handleDeleteOrder(ord.id)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer' }}>
                            Delete Order 🗑️
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: PAST ORDERS & BATCHES ================= */}
        {adminTab === 'past' && (
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#38bdf8', marginBottom: '12px' }}>
              BATCHES & HISTORY
            </h3>

            {/* BATCH SELECTOR CARDS */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '16px' }}>
              <button
                onClick={() => setSelectedPastBatch(null)}
                style={{
                  padding: '8px 14px',
                  background: selectedPastBatch === null ? '#2563eb' : '#18181b',
                  color: selectedPastBatch === null ? '#fff' : '#a1a1aa',
                  border: '1px solid #27272a',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
              >
                All Orders ({pastOrders.length})
              </button>
              {allBatches.map((b) => (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', background: selectedPastBatch === b.batch_name ? '#2563eb' : '#18181b', border: '1px solid #27272a', borderRadius: '20px', paddingRight: '6px' }}>
                  <button
                    onClick={() => setSelectedPastBatch(b.batch_name)}
                    style={{
                      padding: '8px 10px 8px 14px',
                      background: 'none',
                      color: selectedPastBatch === b.batch_name ? '#fff' : '#a1a1aa',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                    }}
                  >
                    {b.batch_name} {!b.is_active && '(Closed)'}
                  </button>
                  {!b.is_active && (
                    <button onClick={() => handleDeleteBatch(b.id, b.batch_name)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', cursor: 'pointer', padding: '0 4px' }}>
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* ORDERS TABLE */}
            <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '16px', padding: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.8fr 0.4fr', paddingBottom: '8px', borderBottom: '1px solid #27272a', fontSize: '12px', color: '#a1a1aa', fontWeight: 700 }}>
                <span>Buyer / Batch</span>
                <span>Item</span>
                <span style={{ textAlign: 'right' }}>Total Paid</span>
                <span style={{ textAlign: 'right' }}>Action</span>
              </div>

              {pastOrders
                .filter((o) => (selectedPastBatch ? o.batch_name === selectedPastBatch : true))
                .map((ord) => (
                  <div key={ord.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.8fr 0.4fr', padding: '12px 0', borderBottom: '1px solid #27272a', fontSize: '12px', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', color: '#fff' }}>{ord.customer_name || ord.customer_phone}</div>
                      <div style={{ fontSize: '10px', color: '#38bdf8' }}>{ord.batch_name}</div>
                    </div>
                    <div style={{ color: '#a1a1aa' }}>{ord.items}</div>
                    <div style={{ textAlign: 'right', fontWeight: 'bold', color: '#4ade80' }}>
                      GH₵ {ord.amount_paid}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => handleDeleteOrder(ord.id)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '13px', cursor: 'pointer' }}
                        title="Delete Order"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
  }
