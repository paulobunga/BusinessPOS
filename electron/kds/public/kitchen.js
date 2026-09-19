(function () {
  'use strict';

  var orders = new Map();
  var alertMinutes = 10;
  var socket = null;
  var audioCtx = null;
  var soundOn = false;
  var flashId = null;
  var toastTimer = null;

  var NEXT = {
    new: { status: 'preparing', label: 'Start Preparing' },
    preparing: { status: 'completed', label: 'Mark Completed' },
    completed: { status: 'served', label: 'Mark Served' }
  };

  var overlay = document.getElementById('pin-overlay');
  var pinInput = document.getElementById('pin-input');
  var startBtn = document.getElementById('start-btn');
  var pinError = document.getElementById('pin-error');
  var connStatus = document.getElementById('conn-status');
  var soundState = document.getElementById('sound-state');
  var toast = document.getElementById('toast');
  var board = document.getElementById('board');
  var columns = {
    new: document.querySelector('section[data-status="new"] .cards'),
    preparing: document.querySelector('section[data-status="preparing"] .cards'),
    completed: document.querySelector('section[data-status="completed"] .cards')
  };

  function setConn(text, cls) {
    connStatus.textContent = text;
    connStatus.className = cls;
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('visible');
    if (toastTimer) {
      clearTimeout(toastTimer);
    }
    toastTimer = setTimeout(function () {
      toast.classList.remove('visible');
    }, 4000);
  }

  function unlockAudio() {
    try {
      if (!audioCtx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) {
          return;
        }
        audioCtx = new AC();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      soundOn = true;
      soundState.textContent = 'Sound on';
    } catch (err) {
      soundOn = false;
    }
  }

  function beep() {
    try {
      if (!audioCtx || !soundOn) {
        return;
      }
      for (var i = 0; i < 2; i++) {
        (function (n) {
          var osc = audioCtx.createOscillator();
          var gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.value = 880;
          var t0 = audioCtx.currentTime + n * 0.35;
          gain.gain.setValueAtTime(0.0001, t0);
          gain.gain.exponentialRampToValueAtTime(0.5, t0 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(t0);
          osc.stop(t0 + 0.3);
        })(i);
      }
    } catch (err) {
      // Audio must never break the display.
    }
  }

  function elapsedSeconds(order) {
    var t = Date.parse(order.created_at);
    if (isNaN(t)) {
      return 0;
    }
    return Math.max(0, Math.floor((Date.now() - t) / 1000));
  }

  function formatElapsed(totalSeconds) {
    var h = Math.floor(totalSeconds / 3600);
    var m = Math.floor((totalSeconds % 3600) / 60);
    var s = totalSeconds % 60;
    function pad(n) {
      return (n < 10 ? '0' : '') + n;
    }
    if (h > 0) {
      return h + ':' + pad(m) + ':' + pad(s);
    }
    return m + ':' + pad(s);
  }

  function isOverdue(order) {
    return elapsedSeconds(order) > alertMinutes * 60;
  }

  function clearChildren(el) {
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }

  function buildCard(order) {
    var card = document.createElement('article');
    card.className = 'card';
    card.setAttribute('data-order-id', String(order.id));

    var top = document.createElement('div');
    top.className = 'card-top';

    var orderNo = document.createElement('span');
    orderNo.className = 'order-no';
    orderNo.textContent = '#' + order.id;
    top.appendChild(orderNo);

    var elapsed = document.createElement('span');
    elapsed.className = 'elapsed';
    elapsed.setAttribute('data-elapsed-for', String(order.id));
    elapsed.textContent = formatElapsed(elapsedSeconds(order));
    top.appendChild(elapsed);

    var tag = document.createElement('span');
    tag.className = 'overdue-tag';
    tag.textContent = 'OVERDUE';
    if (!isOverdue(order)) {
      tag.hidden = true;
    }
    top.appendChild(tag);
    card.appendChild(top);

    var customer = document.createElement('div');
    customer.className = 'card-customer';
    customer.textContent = order.customer_name || 'Walk-in';
    card.appendChild(customer);

    var items = Array.isArray(order.items) ? order.items : [];
    var list = document.createElement('ul');
    list.className = 'card-items';
    items.forEach(function (item) {
      var li = document.createElement('li');
      var qty = item && item.quantity != null ? item.quantity : 1;
      var name = item && item.name_snapshot ? item.name_snapshot : 'Item';
      li.textContent = qty + ' \u00d7 ' + name;
      list.appendChild(li);
    });
    card.appendChild(list);

    if (order.service_description) {
      var service = document.createElement('p');
      service.className = 'card-service';
      service.textContent = order.service_description;
      card.appendChild(service);
    }

    if (isOverdue(order)) {
      card.classList.add('overdue');
    }
    if (flashId === order.id) {
      card.classList.add('flash');
    }

    var next = NEXT[order.kitchen_status];
    if (next) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'advance-btn';
      btn.textContent = next.label;
      btn.setAttribute('data-order-id', String(order.id));
      (function (orderId, status) {
        btn.addEventListener('click', function () {
          if (socket) {
            socket.emit('order:setStatus', { orderId: orderId, status: status });
          }
        });
      })(order.id, next.status);
      card.appendChild(btn);
    }

    return card;
  }

  function renderAll() {
    Object.keys(columns).forEach(function (status) {
      clearChildren(columns[status]);
    });
    orders.forEach(function (order) {
      var column = columns[order.kitchen_status];
      if (!column) {
        return;
      }
      column.appendChild(buildCard(order));
    });
    if (flashId !== null) {
      (function (id) {
        setTimeout(function () {
          var card = board.querySelector('[data-order-id="' + id + '"].flash');
          if (card) {
            card.classList.remove('flash');
          }
        }, 4000);
      })(flashId);
      flashId = null;
    }
  }

  function tickTimes() {
    orders.forEach(function (order) {
      var elapsedEl = board.querySelector('[data-elapsed-for="' + order.id + '"]');
      if (elapsedEl) {
        elapsedEl.textContent = formatElapsed(elapsedSeconds(order));
      }
      var card = board.querySelector('article[data-order-id="' + order.id + '"]');
      if (card) {
        var overdue = isOverdue(order);
        if (overdue) {
          card.classList.add('overdue');
        } else {
          card.classList.remove('overdue');
        }
        var tag = card.querySelector('.overdue-tag');
        if (tag) {
          tag.hidden = !overdue;
        }
      }
    });
  }

  function connect(pin) {
    if (socket) {
      try {
        socket.disconnect();
      } catch (err) {
        // Ignore teardown errors from a previous socket.
      }
      socket = null;
    }
    socket = io('/kitchen', { auth: { token: pin } });

    socket.on('connect', function () {
      pinError.textContent = '';
      overlay.hidden = true;
      setConn('Connected', 'status-connected');
    });

    socket.on('connect_error', function () {
      pinError.textContent = 'Wrong PIN. Try again.';
      try {
        socket.disconnect();
      } catch (err) {
        // Ignore teardown errors; a fresh socket is built on retry.
      }
    });

    socket.on('disconnect', function () {
      setConn('Reconnecting\u2026', 'status-reconnecting');
    });

    socket.on('reconnect_attempt', function () {
      setConn('Reconnecting\u2026', 'status-reconnecting');
    });

    socket.on('kds:config', function (cfg) {
      if (cfg && typeof cfg.alertMinutes === 'number' && cfg.alertMinutes > 0) {
        alertMinutes = cfg.alertMinutes;
        renderAll();
      }
    });

    socket.on('orders:sync', function (payload) {
      var list = Array.isArray(payload) ? payload : (payload && Array.isArray(payload.orders) ? payload.orders : []);
      orders.clear();
      list.forEach(function (order) {
        if (order && typeof order.id === 'number') {
          orders.set(order.id, order);
        }
      });
      renderAll();
    });

    socket.on('order:new', function (order) {
      if (!order || typeof order.id !== 'number') {
        return;
      }
      orders.set(order.id, order);
      flashId = order.id;
      renderAll();
      beep();
    });

    socket.on('order:updated', function (order) {
      if (!order || typeof order.id !== 'number') {
        return;
      }
      if (order.kitchen_status === 'served') {
        orders.delete(order.id);
      } else {
        orders.set(order.id, order);
      }
      renderAll();
    });

    socket.on('order:error', function (payload) {
      var message = payload && payload.message ? String(payload.message) : 'Something went wrong';
      showToast(message);
    });
  }

  startBtn.addEventListener('click', function () {
    unlockAudio();
    var pin = pinInput.value.trim();
    if (!pin) {
      pinError.textContent = 'Enter the kitchen PIN.';
      return;
    }
    pinError.textContent = '';
    setConn('Reconnecting\u2026', 'status-reconnecting');
    connect(pin);
  });

  pinInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      startBtn.click();
    }
  });

  setInterval(tickTimes, 1000);
})();
