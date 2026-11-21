// Token Radar dashboard: the board, one detail view per protocol, and the Live token view.
// No network, no framework: it reads window.RADAR from data.js, written by main.ts from the
// same snapshot. The page recomputes every row's implied value from the snapshot figures with
// the model in the Model section, and checks it against the board: a row whose recomputed
// value differs is marked, so the screenshots and the code agree.
(function () {
  var DATA = window.RADAR;
  var main = document.getElementById('board');
  main.setAttribute('aria-busy', 'false');

  // ---------- formatting ----------
  function fmtUsd(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n;
  }
  function fmtInt(n) { return n === null || n === undefined ? '—' : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function fmtPct(n) {
    if (n === null || n === undefined) return '—';
    return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days < 30) return days + 'd';
    if (days < 365) return Math.round(days / 30) + 'mo';
    return (days / 365).toFixed(1) + 'y';
  }
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'text') node.textContent = attrs[k];
        else if (k === 'class') node.className = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    if (children) {
      if (!Array.isArray(children)) children = [children];
      children.forEach(function (c) { if (c) node.appendChild(c); });
    }
    return node;
  }

  // ---------- the model, in the page: recompute a row from the snapshot figures ----------
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function impliedOf(row) {
    var m = DATA.model;
    var age = row.age_days === null || row.age_days === undefined ? DATA.median_age_days : row.age_days;
    var growth = clamp(row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d, m.growth_floor, m.growth_cap);
    var growthMult = 1 + (growth / 100) * m.growth_weight;
    var maturityMult = m.maturity_floor + (Math.min(Math.max(age, 0), m.maturity_days) / m.maturity_days) * m.maturity_range;
    var chains = Math.max((row.chains || []).length, 1);
    var chainMult = 1 + m.chain_bonus * Math.min(chains - 1, m.chain_bonus_max);
    var base = row.tvl_usd * m.base_multiple;
    return { base: base, growth: growth, growthMult: growthMult, maturityMult: maturityMult, chainMult: chainMult, implied: Math.max(1, Math.round(base * growthMult * maturityMult * chainMult)) };
  }

  // ---------- the farm plan, generated in the page from the same rules as the model ----------
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 45;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + '\'s main pool on ' + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0 || c.indexOf('canonical') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('liquid staking') >= 0 || c.indexOf('restak') >= 0 || c.indexOf('staking pool') >= 0) return 'Stake $' + capital + ' of the chain\'s staking asset through ' + name + ' and keep the receipt token.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('basis trading') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedged position.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('risk curators') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return 'Mint $' + capital + ' of the protocol\'s yield-bearing asset on ' + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy active.';
    if (c.indexOf('yield aggregator') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('farm') >= 0) return 'Deposit $' + capital + ' of USDC into ' + name + '\'s highest-TVL vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('liquidity manager') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' managed range on ' + chain + ' and keep the position open.';
    if (c.indexOf('chain') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + '\'s own bridge and use it in one app there.';
    if (c.indexOf('payment') >= 0) return 'Pay $' + capital + ' through ' + name + ' on ' + chain + ' and keep the receipt.';
    if (c.indexOf('index') >= 0) return 'Buy $' + capital + ' of the ' + name + ' index on ' + chain + ' and hold the shares.';
    if (c.indexOf('governance') >= 0) return 'Lock $' + capital + ' of the governance asset through ' + name + ' on ' + chain + ' and vote once.';
    if (c.indexOf('otc') >= 0) return 'Place one $' + capital + ' order through ' + name + ' on ' + chain + ' and settle it.';
    if (c.indexOf('card') >= 0) return 'Load $' + capital + ' onto the ' + name + ' card and spend it once on ' + chain + '.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function secondActionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Borrow a small amount against the supply, then repay it in the same week.';
    if (c.indexOf('dex') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Swap a small amount through ' + name + '\'s own router once a week.';
    if (c.indexOf('bridge') >= 0 || c.indexOf('canonical') >= 0) return 'Bridge a small amount back the other way so the record shows two-way use.';
    if (c.indexOf('liquid staking') >= 0 || c.indexOf('restak') >= 0 || c.indexOf('staking pool') >= 0) return 'Use the receipt token in one partner pool on ' + chain + ' instead of leaving it idle.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('basis trading') >= 0) return 'Close the hedge and open a fresh one, so the account shows repeated use.';
    if (c.indexOf('prediction') >= 0) return 'Settle one market and open another, instead of leaving a single bet.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('risk curators') >= 0) return 'Move a small share into a second ' + name + ' vault with a different risk profile.';
    if (c.indexOf('stable') >= 0) return 'Use the stable asset in one payment or swap on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return 'Claim one yield payout and re-deposit it into the same asset.';
    if (c.indexOf('insurance') >= 0) return 'File no claim; renew the cover once so the policy stays continuous.';
    if (c.indexOf('yield aggregator') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('farm') >= 0) return 'Harvest the vault\'s rewards once and re-deposit them into the same vault.';
    if (c.indexOf('liquidity manager') >= 0) return 'Rebalance the range once when the price moves out of it.';
    if (c.indexOf('chain') >= 0) return 'Use one native app on ' + chain + ' with the bridged funds.';
    if (c.indexOf('governance') >= 0) return 'Vote on a second proposal once the first one closes.';
    return 'Use ' + name + '\'s second feature once, such as its rewards page, a vote, or a second pool on ' + chain + '.';
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var gas = capital >= 150 ? 8 : 4;
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about $' + gas + ' of gas', time: '15 minutes to set up' },
      { text: secondActionFor(p, capital, chain), cost: 'about $' + gas + ' of gas', time: '10 minutes' },
      { text: 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: 'Before you withdraw, open the protocol\'s own points or rewards page and claim only from the link it publishes; never pay anyone to claim for you.', cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' }
    ];
  }

  // ---------- state from the hash ----------
  function readHash() {
    var h = {};
    location.hash.slice(1).split('&').forEach(function (part) {
      var kv = part.split('=');
      if (kv[0]) h[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
    });
    return {
      q: h.q || '',
      category: h.cat || 'all',
      chain: h.chain || 'all',
      minTvl: h.min || '0',
      tab: h.tab === 'live' ? 'live' : 'pre-token',
      sort: h.sort || 'rank',
      dir: h.dir === 'desc' ? -1 : 1,
      detail: h.detail || ''
    };
  }
  var state = readHash();
  function writeHash() {
    var parts = [];
    if (state.q) parts.push('q=' + encodeURIComponent(state.q));
    if (state.category !== 'all') parts.push('cat=' + encodeURIComponent(state.category));
    if (state.chain !== 'all') parts.push('chain=' + encodeURIComponent(state.chain));
    if (state.minTvl !== '0') parts.push('min=' + state.minTvl);
    if (state.tab === 'live') parts.push('tab=live');
    if (state.sort !== 'rank') parts.push('sort=' + state.sort);
    if (state.dir === -1) parts.push('dir=desc');
    if (state.detail) parts.push('detail=' + encodeURIComponent(state.detail));
    var next = parts.length ? '#' + parts.join('&') : '';
    if (location.hash !== next) history.replaceState(null, '', next);
  }

  // ---------- filtering and sorting ----------
  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    var min = parseInt(state.minTvl, 10) || 0;
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (r.tvl_usd < min) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    var dir = state.dir;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'change') { av = a.change_7d === null ? -1e9 : a.change_7d; bv = b.change_7d === null ? -1e9 : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? -1 : a.age_days; bv = b.age_days === null ? -1 : b.age_days; }
      else if (key === 'implied') { av = a.implied_value_usd; bv = b.implied_value_usd; }
      else { av = a.rank; bv = b.rank; }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return a.rank - b.rank;
    });
  }
  function openDetail(slug) { state.detail = slug; writeHash(); render(); window.scrollTo(0, 0); }
  function closeDetail() { state.detail = ''; writeHash(); render(); }

  // ---------- views ----------
  function header() {
    var top = el('header', { class: 'top' }, [
      el('h1', {}, [document.createTextNode('Token '), el('span', { text: 'Radar' })]),
      el('span', { class: 'badge', text: 'radar-2' })
    ]);
    var lede = el('p', { class: 'lede' }, [
      document.createTextNode('Every pre-token protocol in the snapshot, ranked by what its token would be worth if the protocol\'s record stayed as it is. '),
      el('b', { text: DATA.board_size + ' ranked' }),
      document.createTextNode(', including all '),
      el('b', { text: DATA.watchlist_size + ' on the watchlist' }),
      document.createTextNode(', plus the '),
      el('b', { text: DATA.live_size + ' largest live-token protocols' }),
      document.createTextNode(' for comparison. Snapshot as of ' + DATA.as_of + '.')
    ]);
    var stats = el('div', { class: 'stats' }, [
      el('div', { class: 'stat' }, [el('div', { class: 'n', text: fmtInt(DATA.board_size) }), el('div', { class: 'l', text: 'protocols ranked' })]),
      el('div', { class: 'stat' }, [el('div', { class: 'n', text: fmtInt(DATA.watchlist_size) }), el('div', { class: 'l', text: 'on the watchlist' })]),
      el('div', { class: 'stat' }, [el('div', { class: 'n', text: fmtInt(DATA.early_size) }), el('div', { class: 'l', text: 'found below the floor' })]),
      el('div', { class: 'stat' }, [el('div', { class: 'n', text: fmtUsd(DATA.floor_usd) }), el('div', { class: 'l', text: 'watchlist floor (TVL)' })]),
      el('div', { class: 'stat' }, [el('div', { class: 'n', text: fmtUsd(DATA.rows[0].implied_value_usd) }), el('div', { class: 'l', text: 'top implied value' })])
    ]);
    return [top, lede, stats];
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', placeholder: 'Search name or slug…', value: state.q, 'aria-label': 'Search protocols' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var cat = el('select', { 'aria-label': 'Filter by category' }, [
      el('option', { value: 'all', text: 'All categories' })
    ].concat(categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })));
    cat.addEventListener('change', function () { state.category = cat.value; writeHash(); render(); });
    var chn = el('select', { 'aria-label': 'Filter by chain' }, [
      el('option', { value: 'all', text: 'All chains' })
    ].concat(chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })));
    chn.addEventListener('change', function () { state.chain = chn.value; writeHash(); render(); });
    var min = el('select', { 'aria-label': 'Minimum TVL' }, [
      ['0', 'Any TVL'], ['50000000', 'TVL ≥ $50M'], ['100000000', 'TVL ≥ $100M'], ['500000000', 'TVL ≥ $500M'], ['1000000000', 'TVL ≥ $1B']
    ].map(function (o) { return el('option', { value: o[0], text: o[1], selected: o[0] === state.minTvl ? 'selected' : null }); }));
    min.addEventListener('change', function () { state.minTvl = min.value; writeHash(); render(); });
    var tabs = el('div', { class: 'tabs' }, [
      el('button', { type: 'button', class: 'tab', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; writeHash(); render(); } }),
      el('button', { type: 'button', class: 'tab', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; writeHash(); render(); } })
    ]);
    return el('div', { class: 'controls' }, [search, cat, chn, min, tabs]);
  }

  function sortHeader(key, label) {
    var arrow = state.sort === key ? (state.dir === 1 ? ' ▲' : ' ▼') : '';
    return el('th', {}, [el('button', {
      type: 'button', text: label + arrow,
      onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = key === 'name' ? 1 : -1; } writeHash(); render(); }
    })]);
  }

  function boardTable() {
    var list = sortedRows(filteredRows());
    var head = el('tr', {}, [
      sortHeader('rank', 'Rank'), sortHeader('name', 'Protocol'), sortHeader('tvl', 'TVL'),
      sortHeader('change', '7d'), sortHeader('age', 'Age'), sortHeader('implied', 'Implied value')
    ]);
    var body = el('tbody', {});
    if (list.length === 0) {
      return el('div', { class: 'empty' }, [
        el('p', { text: 'No protocol matches these filters.' }),
        el('button', { class: 'back', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.minTvl = '0'; writeHash(); render(); } })
      ]);
    }
    list.forEach(function (r) {
      var check = impliedOf(r);
      var ok = check.implied === r.implied_value_usd;
      var row = el('tr', { tabindex: '0', onclick: function () { openDetail(r.slug); }, onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } } }, [
        el('td', { class: 'rank num', text: '#' + r.rank }),
        el('td', {}, [
          el('span', { class: 'name', text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' · ' + (r.chains || []).slice(0, 3).join(', ') + ((r.chains || []).length > 3 ? ' +' + ((r.chains || []).length - 3) : '') })
        ]),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'up' : 'down'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num', text: fmtUsd(r.implied_value_usd) + (ok ? '' : ' ⚠') })
      ]);
      body.appendChild(row);
    });
    var count = el('p', { class: 'count', text: list.length + ' of ' + DATA.board_size + ' ranked protocols' + (DATA.watchlist_size ? ' · watchlist covered in full' : '') });
    return [count, el('table', { class: 'board' }, [el('thead', {}, [head]), body])];
  }

  function liveTable() {
    var head = el('tr', {}, [
      el('th', { text: 'Protocol' }), el('th', { class: 'num', text: 'TVL' }),
      el('th', { class: 'num', text: 'Market cap' }), el('th', { class: 'num', text: '7d' })
    ]);
    var body = el('tbody', {});
    DATA.live.forEach(function (r) {
      body.appendChild(el('tr', {}, [
        el('td', {}, [
          el('span', { class: 'name', text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' · ' + (r.chains || []).slice(0, 3).join(', ') })
        ]),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', { class: 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'up' : 'down'), text: fmtPct(r.change_7d) })
      ]));
    });
    return [
      el('p', { class: 'count', text: 'These tokens already trade, so the board shows the market\u2019s own value, never a model\u2019s. They are here so a reader can compare a launch that happened with one that has not.' }),
      el('table', { class: 'board' }, [el('thead', {}, [head]), body])
    ];
  }

  function detailView() {
    var row = null;
    DATA.rows.forEach(function (r) { if (r.slug === state.detail) row = r; });
    if (!row) return el('div', { class: 'empty' }, [el('p', { text: 'No protocol with that slug is on the board.' })]);
    var check = impliedOf(row);
    var steps = farmSteps(row);
    var onFloor = row.watchlist === true;
    var grid = el('div', { class: 'grid' }, [
      el('div', { class: 'cell' }, [el('div', { class: 'n', text: fmtUsd(row.tvl_usd) }), el('div', { class: 'l', text: 'TVL' })]),
      el('div', { class: 'cell' }, [el('div', { class: 'n', text: fmtPct(row.change_7d) }), el('div', { class: 'l', text: 'TVL change, 7 days' })]),
      el('div', { class: 'cell' }, [el('div', { class: 'n', text: fmtAge(row.age_days) }), el('div', { class: 'l', text: 'tracked with no token' })]),
      el('div', { class: 'cell' }, [el('div', { class: 'n', text: fmtUsd(row.implied_value_usd) }), el('div', { class: 'l', text: 'implied value' })]),
      el('div', { class: 'cell' }, [el('div', { class: 'n', text: (row.chains || []).length + ' chain' + ((row.chains || []).length === 1 ? '' : 's') }), el('div', { class: 'l', text: (row.chains || []).join(', ') || 'no chain listed' })]),
      el('div', { class: 'cell' }, [el('div', { class: 'n', text: row.category || 'Other' }), el('div', { class: 'l', text: 'category' })])
    ]);
    var formula = 'implied = TVL × ' + DATA.model.base_multiple + ' × growth × maturity × chains = ' +
      fmtUsd(check.base) + ' × ' + check.growthMult.toFixed(2) + ' × ' + check.maturityMult.toFixed(2) + ' × ' + check.chainMult.toFixed(2) +
      ' = ' + fmtUsd(check.implied) + (check.implied === row.implied_value_usd ? ' ✓ matches the board' : ' ⚠ differs from the board');
    var breakdown = el('table', { class: 'breakdown' }, [el('tbody', {}, [
      el('tr', {}, [el('td', { text: 'Base — TVL × ' + DATA.model.base_multiple }), el('td', { text: fmtUsd(check.base) })]),
      el('tr', {}, [el('td', { text: 'Growth — 7d ' + fmtPct(row.change_7d) + ' clamped to [' + DATA.model.growth_floor + '%, ' + DATA.model.growth_cap + '%]' }), el('td', { text: '× ' + check.growthMult.toFixed(4) })]),
      el('tr', {}, [el('td', { text: 'Maturity — ' + fmtAge(row.age_days) + ' with no token' + (row.age_days === null ? ' (median age ' + DATA.median_age_days + 'd used)' : '') }), el('td', { text: '× ' + check.maturityMult.toFixed(4) })]),
      el('tr', {}, [el('td', { text: 'Chains — live on ' + (row.chains || []).length + ' chain' + ((row.chains || []).length === 1 ? '' : 's') }), el('td', { text: '× ' + check.chainMult.toFixed(4) })]),
      el('tr', {}, [el('td', {}, [el('b', { text: 'Implied value' })]), el('td', {}, [el('b', { text: fmtUsd(row.implied_value_usd) })])])
    ])]);
    var plan = el('ol', { class: 'plan' }, steps.map(function (s) {
      return el('li', {}, [
        document.createTextNode(s.text + ' '),
        el('span', { class: 'cost', text: 'Cost: ' + s.cost + '. Time: ' + s.time + '.' })
      ]);
    }));
    return el('div', { class: 'detail' }, [
      el('button', { class: 'back', type: 'button', text: '← Back to the board', onclick: closeDetail }),
      el('h2', {}, [document.createTextNode('#' + row.rank + ' ' + row.name), onFloor ? el('span', { class: 'tag', text: 'watchlist' }) : null]),
      el('p', { class: 'meta', text: (row.category || 'Other') + ' · ' + (row.chains || []).join(', ') + ' · records no token' }),
      grid,
      el('h3', { text: 'How the value is worked out' }),
      el('div', { class: 'model-line' }, [el('b', { text: formula })]),
      breakdown,
      el('h3', { text: 'Farm plan — seven steps' }),
      plan,
      el('p', { class: 'note', text: 'Implied value is this radar\u2019s own claim from the snapshot\u2019s figures, never a promise the protocol will issue a token or what it would be worth. Amounts are sized from the protocol\u2019s TVL; hold times from its age.' })
    ]);
  }

  function modelPanel() {
    var m = DATA.model;
    return el('section', { class: 'model' }, [
      el('h2', { text: 'The model — radar-2' }),
      el('p', {}, [
        document.createTextNode('implied = TVL × ' + m.base_multiple + ' × (1 + clamp(7d change, ' + m.growth_floor + '%, ' + m.growth_cap + '%) / 100 × ' + m.growth_weight + ') × (' + m.maturity_floor + ' + min(age, ' + m.maturity_days + 'd) / ' + m.maturity_days + 'd × ' + m.maturity_range + ') × (1 + ' + m.chain_bonus + ' × min(chains − 1, ' + m.chain_bonus_max + ')). ')
      ]),
      el('p', { text: 'Age is the days from listed_at to the snapshot date; a protocol with no listed_at uses the rankable set\u2019s median age, ' + DATA.median_age_days + ' days, computed from the snapshot itself. Growth unknown counts as 0. No protocol name is special-cased: the same function scores every row, and this page recomputes each row from its own figures.' }),
      el('p', { text: 'The watchlist is the floor, never the ceiling: the board ranks all ' + DATA.board_size + ' rankable pre-token protocols, ' + DATA.early_size + ' of them below the $50M floor. The Live token tab keeps the protocols whose token already trades apart, at the market\u2019s own values.' })
    ]);
  }

  function footer() {
    return el('footer', {}, [
      document.createTextNode('Source: DefiLlama protocols, fetched ' + DATA.as_of + '. The snapshot carries no ranking and no farm plan; both are this entry\u2019s work. '),
      document.createTextNode('A protocol that records no token may still have one its DefiLlama record does not carry. Nothing here is financial advice.')
    ]);
  }

  function render() {
    var wrap = el('div', { class: 'wrap' }, header());
    wrap.appendChild(controls());
    if (state.detail) wrap.appendChild(detailView());
    else if (state.tab === 'live') liveTable().forEach(function (n) { wrap.appendChild(n); });
    else boardTable().forEach(function (n) { wrap.appendChild(n); });
    wrap.appendChild(modelPanel());
    wrap.appendChild(footer());
    main.replaceChildren(wrap);
  }

  window.addEventListener('hashchange', function () { state = readHash(); render(); });
  render();
})();
