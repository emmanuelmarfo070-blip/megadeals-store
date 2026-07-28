'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState('');

  const [adminTab, setAdminTab] = useState('present');
  const [presentSubTab, setPresentSubTab] = useState('orders');

  const [activeBatch, setActiveBatch] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [currentOrders, setCurrentOrders] = useState<any[]>([]);
  const [allBatches, setAllBatches] = useState<any[]>([]);
  const [pastOrders, setPastOrders] = useState<any[]>([]);
  const [selectedPastBatch, setSelectedPastBatch] = useState<string | null>(null);

  // SEARCH & PAGINATION
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ordersPerPage = 10;

  const [newTitle, setNewTitle] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newSizes, setNewSizes] = useState('S, M, L, XL');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [newBatchName, setNewBatchName] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      loadAdminData();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    setCurrentPage(1);
  }, [adminTab, presentSubTab, selectedPastBatch, searchQuery]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === 'Emma$1234') {
      setIsAuthenticated(true);
    } else {
      alert('Incorrect passcode!');
    }
  };

  const loadAdminData = async () => {
    const { data: batchData } = await supabase
      .from('batches')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (batchData) {
      setActiveBatch(batchData);

      const { data: prodData } = await supabase
        .from('products')
        .select('*')
        .eq('batch_id', batchData.id)
        .order('id', { ascending: false });
      if (prodData) setProducts(prodData);

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

    const { data: batchList } = await supabase
      .from('batches')
      .select('*')
      .order('created_at', { ascending: false });
    if (batchList) setAllBatches(batchList);

    const { data: allOrd } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (allOrd) setPastOrders(allOrd);
  };

  // CHANGE BATCH STATUS & CASCADE TO ALL ORDERS IN THIS BATCH
  const handleBatchStatusChange = async (batchId: number, batchName: string, newStatus: string) => {
    // 1. Update the batches table
    const { error: batchError } = await supabase
      .from('batches')
      .update({ status: newStatus })
      .eq('id', batchId);

    if (batchError) {
      alert('Failed to update batch status: ' + batchError.message);
      return;
    }

    // 2. Cascade updated batch status across all orders for this batch
    const { error: orderError } = await supabase
      .from('orders')
      .update({ batch_status: newStatus })
      .eq('batch_name', batchName);

    if (orderError) {
      alert('Updated batch status, but failed to update orders: ' + orderError.message);
    } else {
      alert(`Updated "${batchName}" status to: ${newStatus}`);
    }

    // 3. Reload state
    loadAdminData();
  };

  const handleOrderStatusChange = async (orderId: number, newStatus: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) {
      alert('Failed to update order status: ' + error.message);
    } else {
      loadAdminData();
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newPrice) return alert('Fill in title and price');
    if (!activeBatch) return alert('No active batch found!');

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

  const handleRemoveProduct = async (id: number) => {
    if (!confirm('Remove this product?')) return;
    await supabase.from('products').delete().eq('id', id);
    loadAdminData();
  };

  const handleEndBatch = async () => {
    if (!activeBatch) return;
    if (!confirm(`Are you sure you want to end "${activeBatch.batch_name}"?`)) return;

    await supabase.from('batches').update({ is_active: false }).eq('id', activeBatch.id);
    alert(`Batch "${activeBatch.batch_name}" ended! Stats saved to history.`);
    loadAdminData();
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatchName) return alert('Enter a batch name!');

    await supabase.from('batches').update({ is_active: false }).eq('is_active', true);

    const { error } = await supabase.from('batches').insert([
      { batch_name: newBatchName, is_active: true, status: 'Processing' }
    ]);

    if (error) {
      alert('Error creating batch: ' + error.message);
    } else {
      alert(`New drop "${newBatchName}" created!`);
      setNewBatchName('');
      loadAdminData();
    }
  };

  const handleDeleteOrder = async (orderId: number) => {
    if (!confirm('Delete this order?')) return;
    const { error } = await supabase.from('orders').delete().eq('id', orderId);
    if (error) {
      alert('Error deleting order: ' + error.message);
    } else {
      loadAdminData();
    }
  };

  const handleDeleteBatch = async (batchId: number, batchName: string) => {
    if (!confirm(`Delete batch "${batchName}"?`)) return;
    const { error } = await supabase.from('batches').delete().eq('id', batchId);
    if (error) {
      alert('Error deleting batch: ' + error.message);
    } else {
      if (selectedPastBatch === batchName) setSelectedPastBatch(null);
      loadAdminData();
    }
  };

  // REVENUE CALCULATIONS
  const calculateBatchMetrics = (ordersList: any[]) => {
    let actualCollected = 0;
    let expectedTotal100 = 0;

    ordersList.forEach((ord) => {
      const depositPaid = Number(ord.amount_paid || 0);
      actualCollected += depositPaid;

      if (ord.total_price) {
        expectedTotal100 += Number(ord.total_price);
      } else if (depositPaid > 0) {
        expectedTotal100 += Math.round(depositPaid / 0.7);
      }
    });

    const pendingBalance = expectedTotal100 - actualCollected;

    return {
      actualCollected,
      expectedTotal100,
      pendingBalance,
      totalOrders: ordersList.length,
    };
  };

  const currentMetrics = calculateBatchMetrics(currentOrders);

  // Supplier Tally
  const supplierTally = currentOrders.reduce((acc: Record<string, Record<string, number>>, ord) => {
    if (!ord.items) return acc;
    const itemsArray = ord.items.split(',').map((item: string) => item.trim());

    itemsArray.forEach((itemString: string) => {
      const match = itemString.match(/^(.*?)\s*\((.*?)\)$/);
      let productName = itemString;
      let size = 'Standard';

      if (match) {
        productName = match[1].trim();
        size = match[2].trim().toUpperCase();
      }

      if (!acc[productName]) acc[productName] = {};
      acc[productName][size] = (acc[productName][size] || 0) + 1;
    });

    return acc;
  }, {});

  // Search Filter
  const filterOrders = (ordersList: any[]) => {
    return ordersList.filter((ord) => {
      const name = (ord.customer_name || '').toLowerCase();
      const phone = (ord.customer_phone || '').toLowerCase();
      const items = (ord.items || '').toLowerCase();
      const query = searchQuery.toLowerCase();
      return name.includes(query) || phone.includes(query) || items.includes(query);
    });
  };

  const filteredCurrentOrders = filterOrders(currentOrders);
  const filteredPastOrders = filterOrders(
    pastOrders.filter((o) => (selectedPastBatch ? o.batch_name === selectedPastBatch : true))
  );

  const getPaginatedData = (dataList: any[]) => {
    const startIndex = (currentPage - 1) * ordersPerPage;
    return dataList.slice(startIndex, startIndex + ordersPerPage);
  };

  const currentBatchArrived = activeBatch?.status === 'Arrived in Ghana';

  // Find object for currently selected past batch
  const selectedPastBatchObj = allBatches.find((b) => b.batch_name === selectedPastBatch);
  const pastBatchArrived = selectedPastBatchObj?.status === 'Arrived in Ghana';

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

        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 900 }}>STORE ADMIN PANEL</h1>
          <button onClick={() => setIsAuthenticated(false)} style={{ background: '#27272a', border: 'none', color: '#a1a1aa', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
            Lock Panel 🔒
          </button>
        </header>

        {/* SEARCH BAR */}
        <div style={{ marginBottom: '16px' }}>
          <input
            type="text"
            placeholder="🔍 Search buyer name, phone, or item..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '12px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '10px', fontSize: '13px', boxSizing: 'border-box' }}
          />
        </div>

        {/* TABS */}
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
                {/* REVENUE STATS */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ background: '#18181b', border: '1px solid #27272a', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 700 }}>EXPECTED TOTAL (100%)</div>
                    <div style={{ fontSize: '18px', fontWeight: 900, color: '#38bdf8', marginTop: '2px' }}>GH₵ {currentMetrics.expectedTotal100.toLocaleString()}</div>
                  </div>
                  <div style={{ background: '#18181b', border: '1px solid #27272a', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 700 }}>ACTUAL COLLECTED (70%)</div>
                    <div style={{ fontSize: '18px', fontWeight: 900, color: '#4ade80', marginTop: '2px' }}>GH₵ {currentMetrics.actualCollected.toLocaleString()}</div>
                  </div>
                </div>

                {/* BATCH STATUS CONTROL */}
                <div style={{ background: '#18181b', border: '1px solid #2563eb', borderRadius: '16px', padding: '16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#93c5fd', fontWeight: 800 }}>BATCH STATUS TRIGGER</div>
                    <div style={{ fontSize: '11px', color: '#a1a1aa' }}>Affects all buyers in {activeBatch.batch_name}</div>
                  </div>
                  <select
                    value={activeBatch.status || 'Processing'}
                    onChange={(e) => handleBatchStatusChange(activeBatch.id, activeBatch.batch_name, e.target.value)}
                    style={{ background: '#09090b', color: '#38bdf8', border: '1px solid #2563eb', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    <option value="Processing">Processing 📦</option>
                    <option value="Shipped from China">Shipped from China ✈️</option>
                    <option value="Arrived in Ghana">Arrived in Ghana 🇬🇭</option>
                    <option value="Delivered">Completed / Delivered ✅</option>
                  </select>
                </div>

                {/* ADD PRODUCT FORM */}
                <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#38bdf8' }}>+ ADD GOODS TO {activeBatch.batch_name.toUpperCase()}</span>
                    <button onClick={handleEndBatch} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                      End Batch & Save
                    </button>
                  </div>

                  <form onSubmit={handleAddProduct}>
                    <input
                      type="text"
                      placeholder="Product Name"
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
                      <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} style={{ color: '#a1a1aa', fontSize: '12px' }} />
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

                {/* PRESENT GOODS */}
                <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#38bdf8', marginBottom: '12px' }}>
                    PRESENT BATCH GOODS ({products.length})
                  </h3>
                  {products.length === 0 ? (
                    <p style={{ fontSize: '12px', color: '#71717a' }}>No products in this drop yet.</p>
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

                {/* BUYERS & SUPPLIER TALLY */}
                <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '16px', padding: '16px' }}>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
                    <button
                      onClick={() => setPresentSubTab('orders')}
                      style={{
                        background: presentSubTab === 'orders' ? '#27272a' : 'transparent',
                        color: presentSubTab === 'orders' ? '#38bdf8' : '#71717a',
                        border: 'none',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      Buyers ({filteredCurrentOrders.length})
                    </button>
                    <button
                      onClick={() => setPresentSubTab('supplier')}
                      style={{
                        background: presentSubTab === 'supplier' ? '#27272a' : 'transparent',
                        color: presentSubTab === 'supplier' ? '#38bdf8' : '#71717a',
                        border: 'none',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      Supplier Tally List 📋
                    </button>
                  </div>

                  {presentSubTab === 'orders' ? (
                    filteredCurrentOrders.length === 0 ? (
                      <p style={{ fontSize: '12px', color: '#71717a' }}>No orders found.</p>
                    ) : (
                      <div>
                        {getPaginatedData(filteredCurrentOrders).map((ord) => {
                          const depositPaid = Number(ord.amount_paid || 0);
                          const total100Price = ord.total_price ? Number(ord.total_price) : Math.round(depositPaid / 0.7);
                          const balance30 = total100Price - depositPaid;
                          const deliveryFee = 30;
                          const finalArrivalAmount = balance30 + deliveryFee;

                          return (
                            <div key={ord.id} style={{ background: '#09090b', border: '1px solid #27272a', padding: '12px', borderRadius: '10px', marginBottom: '10px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '13px' }}>
                                  {ord.customer_name} ({ord.customer_phone})
                                </span>
                                <span style={{ color: '#4ade80', fontWeight: 'bold', fontSize: '13px' }}>
                                  Paid: GH₵ {depositPaid}
                                </span>
                              </div>

                              <div style={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '6px' }}>Item: {ord.items}</div>

                              {currentBatchArrived ? (
                                <div style={{ background: '#1e1b4b', border: '1px solid #4338ca', borderRadius: '8px', padding: '10px', margin: '8px 0' }}>
                                  <div style={{ fontSize: '11px', color: '#818cf8', fontWeight: 800, marginBottom: '2px' }}>
                                    🇬🇭 ARRIVED IN GHANA — REMAINING PAYMENT
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#c7d2fe', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>30% Balance:</span>
                                    <b>GH₵ {balance30}</b>
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#c7d2fe', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Delivery Fee:</span>
                                    <b>GH₵ {deliveryFee}</b>
                                  </div>
                                  <div style={{ fontSize: '13px', color: '#4ade80', fontWeight: 900, display: 'flex', justifyContent: 'space-between', marginTop: '4px', paddingTop: '4px', borderTop: '1px dashed #4338ca' }}>
                                    <span>Total Due:</span>
                                    <span>GH₵ {finalArrivalAmount}</span>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ fontSize: '11px', color: '#a1a1aa', fontStyle: 'italic', marginBottom: '6px' }}>
                                  ⏳ 30% balance + delivery fee triggers when batch arrives in Ghana.
                                </div>
                              )}

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                                <select
                                  value={ord.status || 'Deposit Paid'}
                                  onChange={(e) => handleOrderStatusChange(ord.id, e.target.value)}
                                  style={{ background: '#18181b', color: '#60a5fa', border: '1px solid #3f3f46', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                                >
                                  <option value="Deposit Paid">70% Deposit Paid 💳</option>
                                  <option value="Final Payment Received">100% Fully Paid ✅</option>
                                  <option value="Delivered">Delivered 🚚</option>
                                </select>

                                <button onClick={() => handleDeleteOrder(ord.id)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer' }}>
                                  Delete 🗑️
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {filteredCurrentOrders.length > ordersPerPage && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #27272a' }}>
                            <button
                              disabled={currentPage === 1}
                              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                              style={{ background: currentPage === 1 ? '#18181b' : '#2563eb', color: currentPage === 1 ? '#52525b' : '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                            >
                              ← Prev
                            </button>
                            <span style={{ fontSize: '12px', color: '#a1a1aa' }}>
                              Page {currentPage} of {Math.ceil(filteredCurrentOrders.length / ordersPerPage)}
                            </span>
                            <button
                              disabled={currentPage >= Math.ceil(filteredCurrentOrders.length / ordersPerPage)}
                              onClick={() => setCurrentPage((prev) => prev + 1)}
                              style={{ background: currentPage >= Math.ceil(filteredCurrentOrders.length / ordersPerPage) ? '#18181b' : '#2563eb', color: currentPage >= Math.ceil(filteredCurrentOrders.length / ordersPerPage) ? '#52525b' : '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: currentPage >= Math.ceil(filteredCurrentOrders.length / ordersPerPage) ? 'not-allowed' : 'pointer' }}
                            >
                              Next →
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  ) : (
                    <div>
                      <div style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '10px' }}>
                        Live China supplier order breakdown:
                      </div>
                      {Object.keys(supplierTally).length === 0 ? (
                        <p style={{ fontSize: '12px', color: '#71717a' }}>No items ordered yet.</p>
                      ) : (
                        Object.entries(supplierTally).map(([productName, sizesObj], idx) => (
                          <div key={idx} style={{ background: '#09090b', border: '1px solid #27272a', padding: '12px', borderRadius: '10px', marginBottom: '8px' }}>
                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#38bdf8', marginBottom: '6px' }}>
                              {productName}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '8px' }}>
                              {Object.entries(sizesObj).map(([size, count], sIdx) => (
                                <div key={sIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                                  <span style={{ color: '#f4f4f5', fontWeight: '600' }}>• Size: {size}</span>
                                  <span style={{ background: '#1e3a8a', color: '#93c5fd', border: '1px solid #1d4ed8', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                                    Qty: {count}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PAST ORDERS & BATCHES TAB */}
        {adminTab === 'past' && (
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#38bdf8', marginBottom: '12px' }}>
              BATCHES & HISTORY
            </h3>

            {/* BATCH CHIPS */}
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

            {/* STATUS TRIGGER FOR SELECTED PAST BATCH */}
            {selectedPastBatchObj && (
              <div style={{ background: '#18181b', border: '1px solid #2563eb', borderRadius: '16px', padding: '16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#93c5fd', fontWeight: 800 }}>BATCH STATUS TRIGGER</div>
                  <div style={{ fontSize: '11px', color: '#a1a1aa' }}>Updates status for all buyers in {selectedPastBatchObj.batch_name}</div>
                </div>
                <select
                  value={selectedPastBatchObj.status || 'Processing'}
                  onChange={(e) => handleBatchStatusChange(selectedPastBatchObj.id, selectedPastBatchObj.batch_name, e.target.value)}
                  style={{ background: '#09090b', color: '#38bdf8', border: '1px solid #2563eb', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  <option value="Processing">Processing 📦</option>
                  <option value="Shipped from China">Shipped from China ✈️</option>
                  <option value="Arrived in Ghana">Arrived in Ghana 🇬🇭</option>
                  <option value="Delivered">Completed / Delivered ✅</option>
                </select>
              </div>
            )}

            {/* FINANCIAL REVENUE SUMMARY */}
            {(() => {
              const historicalMetrics = calculateBatchMetrics(filteredPastOrders);
              return (
                <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '800', color: '#a1a1aa', marginBottom: '10px' }}>
                    FINANCIAL SUMMARY ({selectedPastBatch ? selectedPastBatch.toUpperCase() : 'ALL BATCHES'})
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ background: '#09090b', padding: '10px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '10px', color: '#a1a1aa' }}>100% EXPECTED TOTAL</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#38bdf8' }}>GH₵ {historicalMetrics.expectedTotal100.toLocaleString()}</div>
                    </div>
                    <div style={{ background: '#09090b', padding: '10px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '10px', color: '#a1a1aa' }}>ACTUAL DEPOSITS PAID</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#4ade80' }}>GH₵ {historicalMetrics.actualCollected.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* CLOSED ORDERS LIST */}
            <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '16px', padding: '16px' }}>
              {filteredPastOrders.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#71717a', padding: '12px 0' }}>No historical orders found.</p>
              ) : (
                getPaginatedData(filteredPastOrders).map((ord) => {
                  const depositPaid = Number(ord.amount_paid || 0);
                  const total100Price = ord.total_price ? Number(ord.total_price) : Math.round(depositPaid / 0.7);
                  const balance30 = total100Price - depositPaid;
                  const deliveryFee = 30;
                  const finalArrivalAmount = balance30 + deliveryFee;

                  // Check if this specific order's batch is marked "Arrived in Ghana"
                  const isThisOrderBatchArrived = pastBatchArrived || ord.batch_status === 'Arrived in Ghana';

                  return (
                    <div key={ord.id} style={{ background: '#09090b', border: '1px solid #27272a', padding: '12px', borderRadius: '10px', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <div>
                          <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '13px' }}>
                            {ord.customer_name || 'Customer'}
                          </span>
                          <span style={{ fontSize: '10px', color: '#38bdf8', marginLeft: '6px' }}>
                            ({ord.batch_name})
                          </span>
                        </div>
                        <span style={{ color: '#4ade80', fontWeight: 'bold', fontSize: '13px' }}>
                          GH₵ {depositPaid}
                        </span>
                      </div>

                      <div style={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '6px' }}>Item: {ord.items}</div>

                      {/* 30% BALANCE & DELIVERY FEE TRIGGER */}
                      {isThisOrderBatchArrived ? (
                        <div style={{ background: '#1e1b4b', border: '1px solid #4338ca', borderRadius: '8px', padding: '10px', margin: '8px 0' }}>
                          <div style={{ fontSize: '11px', color: '#818cf8', fontWeight: 800, marginBottom: '2px' }}>
                            🇬🇭 ARRIVED IN GHANA — REMAINING PAYMENT
                          </div>
                          <div style={{ fontSize: '12px', color: '#c7d2fe', display: 'flex', justifyContent: 'space-between' }}>
                            <span>30% Balance:</span>
                            <b>GH₵ {balance30}</b>
                          </div>
                          <div style={{ fontSize: '12px', color: '#c7d2fe', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Delivery Fee:</span>
                            <b>GH₵ {deliveryFee}</b>
                          </div>
                          <div style={{ fontSize: '13px', color: '#4ade80', fontWeight: 900, display: 'flex', justifyContent: 'space-between', marginTop: '4px', paddingTop: '4px', borderTop: '1px dashed #4338ca' }}>
                            <span>Total Due:</span>
                            <span>GH₵ {finalArrivalAmount}</span>
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '11px', color: '#a1a1aa', fontStyle: 'italic', marginBottom: '6px' }}>
                          ⏳ 30% balance + delivery fee triggers when batch status is set to "Arrived in Ghana".
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                        <select
                          value={ord.status || 'Deposit Paid'}
                          onChange={(e) => handleOrderStatusChange(ord.id, e.target.value)}
                          style={{ background: '#18181b', color: '#60a5fa', border: '1px solid #3f3f46', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                          <option value="Deposit Paid">70% Deposit Paid 💳</option>
                          <option value="Final Payment Received">100% Fully Paid ✅</option>
                          <option value="Delivered">Delivered 🚚</option>
                        </select>

                        <button onClick={() => handleDeleteOrder(ord.id)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer' }}>
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })
              )}

              {/* PAGINATION */}
              {filteredPastOrders.length > ordersPerPage && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #27272a' }}>
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    style={{ background: currentPage === 1 ? '#18181b' : '#2563eb', color: currentPage === 1 ? '#52525b' : '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                  >
                    ← Prev
                  </button>
                  <span style={{ fontSize: '12px', color: '#a1a1aa' }}>
                    Page {currentPage} of {Math.ceil(filteredPastOrders.length / ordersPerPage)}
                  </span>
                  <button
                    disabled={currentPage >= Math.ceil(filteredPastOrders.length / ordersPerPage)}
                    onClick={() => setCurrentPage((prev) => prev + 1)}
                    style={{ background: currentPage >= Math.ceil(filteredPastOrders.length / ordersPerPage) ? '#18181b' : '#2563eb', color: currentPage >= Math.ceil(filteredPastOrders.length / ordersPerPage) ? '#52525b' : '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: currentPage >= Math.ceil(filteredPastOrders.length / ordersPerPage) ? 'not-allowed' : 'pointer' }}
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
