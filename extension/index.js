// L·Bridge 1.0 — 注入预览⭐标注 + 集中错误日志面板
(function () {
    'use strict';

    // ========== 进度条（底部浮动，显示当前配图进度） ==========
    // ========== 集中错误日志（全局兜底 + 手动记录） ==========
    var errLogs = [];
    function logErr(source, err, isInfo) {
        try {
            var msg = '';
            if (err && err.message) msg = err.message;
            else if (typeof err === 'string') msg = err;
            else { try { msg = JSON.stringify(err); } catch (e2) { msg = String(err); } }
            var stack = '';
            if (err && err.stack) stack = String(err.stack).split('\n').slice(0, 3).join(' | ');
            errLogs.push({ t: new Date().toLocaleTimeString(), src: source, msg: String(msg).slice(0, 600), stack: String(stack).slice(0, 300), info: !!isInfo });
            if (errLogs.length > 200) errLogs.shift();
            var errCount = errLogs.filter(function (x) { return !x.info; }).length;
            var badge = document.getElementById('rpgda-errbadge');
            if (badge) { badge.textContent = errCount; badge.style.display = errCount ? 'inline-block' : 'none'; }
        } catch (e) {}
    }
    function logInfo(source, msg) { logErr(source, msg, true); }
    function renderErrLog() {
        var box = document.getElementById('rpgda-errbody');
        if (!box) return;
        if (!errLogs.length) { box.textContent = '（暂无记录。所有拉取/生图/保存失败、未捕获异常、console.error、图API请求过程都会汇总到这里；[信息] 为正常工作返回，如轮询/重试/成功消息。）'; updateErrSummary(); return; }
        var errs = [], infos = [];
        for (var i = errLogs.length - 1; i >= 0; i--) {
            var e = errLogs[i];
            var block = '[' + e.t + ']' + (e.info ? ' [信息] ' : ' ') + e.src + '\n  ' + e.msg + (e.stack ? '\n  ↳ ' + e.stack : '') + '\n';
            (e.info ? infos : errs).push(block);
        }
        var html = '';
        html += '<div style="margin:2px 0;padding:6px 8px;border-radius:6px;border:1px solid;cursor:pointer;" id="rpgda-errtab-err"><b>❌ 错误日志</b> <small id="rpgda-errtab-err-cnt"></small><span style="float:right;">▾</span></div>';
        html += '<div id="rpgda-errtab-err-body" style="display:block;white-space:pre-wrap;padding:2px 4px 6px;">' + (errs.length ? errs.join('') : '（无错误）') + '</div>';
        html += '<div style="margin:2px 0;padding:6px 8px;border-radius:6px;border:1px solid;cursor:pointer;" id="rpgda-errtab-ok"><b>✅ 正常返回</b> <small id="rpgda-errtab-ok-cnt"></small><span style="float:right;">▸</span></div>';
        html += '<div id="rpgda-errtab-ok-body" style="display:none;white-space:pre-wrap;padding:2px 4px 6px;">' + (infos.length ? infos.join('') : '（无）') + '</div>';
        box.innerHTML = html;
        var ec = document.getElementById('rpgda-errtab-err-cnt');
        if (ec) ec.textContent = '(' + errs.length + ' 条)';
        var oc = document.getElementById('rpgda-errtab-ok-cnt');
        if (oc) oc.textContent = '(' + infos.length + ' 条)';
        var te = document.getElementById('rpgda-errtab-err');
        if (te) te.onclick = function () {
            var b = document.getElementById('rpgda-errtab-err-body');
            var open = b.style.display !== 'none';
            b.style.display = open ? 'none' : 'block';
            te.querySelector('span').textContent = open ? '▸' : '▾';
        };
        var to = document.getElementById('rpgda-errtab-ok');
        if (to) to.onclick = function () {
            var b = document.getElementById('rpgda-errtab-ok-body');
            var open = b.style.display !== 'none';
            b.style.display = open ? 'none' : 'block';
            to.querySelector('span').textContent = open ? '▸' : '▾';
        };
        updateErrSummary();
    }
    function updateErrSummary() {
        var box = document.getElementById('rpgda-wlog-err-summary');
        if (!box) return;
        var errs = errLogs.filter(function (x) { return !x.info; }).length;
        var infos = errLogs.filter(function (x) { return x.info; }).length;
        box.textContent = errs || infos ? ('错误 ' + errs + ' 条 · 正常 ' + infos + ' 条（点击展开明细）') : '（点击展开：错误日志 / 正常返回）';
    }
    function renderApiCallSummary() {
        var box = document.getElementById('rpgda-wlog-api-summary');
        if (!box) return;
        if (!reqStats || !reqStats.list || !reqStats.list.length) { box.textContent = '（点击展开：共调用几次、成功/失败、Token）'; return; }
        if (reqStats.done === false) { box.textContent = '（当前消息配图进行中：全部生成完成后这里显示最终统计）'; return; }
        var ok = 0, failN = 0;
        reqStats.list.forEach(function (st) { if (st.ok) ok++; else failN++; });
        box.textContent = '最后一条消息共调用 ' + reqStats.list.length + ' 次：成功 ' + ok + ' / 失败 ' + failN + '（点击展开明细）';
    }
    function renderApiCallDetail() {
        var box = document.getElementById('rpgda-apibody');
        if (!box) return;
        if (!reqStats || !reqStats.list || !reqStats.list.length) { box.textContent = '（暂无API调用记录。跑完一条消息后这里会显示：一条消息共调用几次、每次成功/失败、单次请求（一片）Token、一条消息（全片）Token。）'; renderApiCallSummary(); return; }
        if (reqStats.done === false) { box.textContent = '（配图进行中：等最后一条消息完整生成并全部配图完成后，这里显示本次最终统计）'; renderApiCallSummary(); return; }
        var ok = 0, failN = 0, blk = 0, ret = 0, pt = 0, ct = 0;
        reqStats.list.forEach(function (st) {
            if (st.ok) ok++; else failN++;
            blk += st.blocks || 0;
            ret += st.retries || 0;
            pt += st.promptTok || 0;
            ct += st.compTok || 0;
        });
        var html = '<div style="padding:4px 6px;margin-bottom:4px;border-radius:6px;border:1px solid;"><b>📊 摘要</b><br>' +
            '消息「' + (reqStats.msgName || reqStats.msgId || '-') + '」共调用 ' + reqStats.list.length + ' 次：成功 ' + ok + ' / 失败 ' + failN + '<br>' +
            '总图块 ' + blk + ' 张 · 自动重试 ' + ret + ' 次<br>' +
            '全片 Token：输入 ' + pt + ' / 输出 ' + ct + ' / 合计 ' + (pt + ct) + '</div>';
        html += '<div style="margin:2px 0;padding:6px 8px;border-radius:6px;border:1px solid;cursor:pointer;" id="rpgda-apitab-detail"><b>📋 逐次明细</b> <small>(' + reqStats.list.length + ' 次)</small><span style="float:right;">▸</span></div>';
        html += '<div id="rpgda-apitab-detail-body" style="display:none;white-space:pre-wrap;padding:2px 4px 6px;">';
        reqStats.list.forEach(function (st, i) {
            html += '[' + (i + 1) + '] ' + (st.ok ? '✅ 成功' : '❌ 失败') +
                ' · 请求 ' + (st.segs || 1) + ' 片' +
                ' · 图块 ' + (st.blocks || 0) +
                ' · 重试 ' + (st.retries || 0) +
                ' · Token 入 ' + (st.promptTok || 0) + ' / 出 ' + (st.compTok || 0) +
                (st.err ? ' · 错误：' + st.err : '') + '\n';
        });
        html += '</div>';
        box.innerHTML = html;
        var td = document.getElementById('rpgda-apitab-detail');
        if (td) td.onclick = function () {
            var b = document.getElementById('rpgda-apitab-detail-body');
            var open = b.style.display !== 'none';
            b.style.display = open ? 'none' : 'block';
            td.querySelector('span').textContent = open ? '▸' : '▾';
        };
        renderApiCallSummary();
    }
    function ensureErrPanel() {
        if (document.getElementById('rpgda-err-panel')) return;
        var dp = document.createElement('div');
        dp.id = 'rpgda-err-panel';
        dp.className = 'rpgda-errpanel';
        dp.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483001;padding:14px 16px 56px;box-sizing:border-box;overflow-y:auto;-webkit-overflow-scrolling:touch;display:none;font:12px/1.6 system-ui;';
        dp.innerHTML = '<div id="rpgda-err-header" style="display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;padding:6px 0;z-index:2;"><b>🛠 工作日志</b><span style="display:flex;gap:10px;">' +
            '<span id="rpgda-errcopy" style="cursor:pointer;">复制</span>' +
            '<span id="rpgda-errclear" style="cursor:pointer;">清空</span>' +
            '<span id="rpgda-errclose" style="cursor:pointer;font-size:20px;">✕</span></span></div>' +
            '<div class="rpgda-wlog-head" id="rpgda-wlog-inj-head" style="margin:8px 0 4px;padding:8px 10px;border:1px solid;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:6px;flex-wrap:wrap;"><b>🔍 注入预览</b> <small class="rpgda-wlog-hint">（点击展开：生图规则来源、角色注入、配图粒度、请求预览）</small><span class="rpgda-wlog-arrow">▸</span></div>' +
            '<div id="rpgda-injbody" style="display:none;white-space:pre-wrap;padding:2px 4px 8px;"></div>' +
            '<div class="rpgda-wlog-head" id="rpgda-wlog-api-head" style="margin:8px 0 4px;padding:8px 10px;border:1px solid;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:6px;flex-wrap:wrap;"><b>📊 API 调用</b> <small class="rpgda-wlog-hint" id="rpgda-wlog-api-summary">（点击展开：共调用几次、成功/失败、Token）</small><span class="rpgda-wlog-arrow">▸</span></div>' +
            '<div id="rpgda-apibody" style="display:none;padding:2px 4px 8px;"></div>' +
            '<div class="rpgda-wlog-head" id="rpgda-wlog-err-head" style="margin:8px 0 4px;padding:8px 10px;border:1px solid;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:6px;flex-wrap:wrap;"><b>⚠️ 报错与正常返回</b> <small class="rpgda-wlog-hint" id="rpgda-wlog-err-summary">（点击展开：错误日志 / 正常返回）</small><span class="rpgda-wlog-arrow">▸</span></div>' +
            '<div id="rpgda-errbody" style="display:none;padding:2px 4px 8px;"></div>';
        document.body.appendChild(dp);
        // 主题应用（面板样式跟随当前主题）
        if (window.__rpgdaApplyErrTheme) window.__rpgdaApplyErrTheme();
        document.getElementById('rpgda-errclose').onclick = function () { dp.style.display = 'none'; };
        document.getElementById('rpgda-errclear').onclick = function () { errLogs.length = 0; renderErrLog(); renderApiCallSummary(); var b = document.getElementById('rpgda-errbadge'); if (b) b.style.display = 'none'; };
        document.getElementById('rpgda-errcopy').onclick = function () {
            var parts = [];
            var t1 = document.getElementById('rpgda-injbody');
            var t2 = document.getElementById('rpgda-apibody');
            var t3 = document.getElementById('rpgda-errbody');
            if (t1 && t1.textContent) parts.push('【注入预览】\n' + t1.textContent);
            if (t2 && t2.textContent) parts.push('【API调用】\n' + t2.textContent);
            if (t3 && t3.textContent) parts.push('【报错与正常返回】\n' + t3.textContent);
            var t = parts.join('\n\n');
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { if (window.toastr) toastr.success('工作日志已复制'); }).catch(function () {});
        };
        // 两级展开：点标题展开内容；再点内容区里的"展开明细/收起"细分
        document.getElementById('rpgda-wlog-inj-head').onclick = function () {
            var b = document.getElementById('rpgda-injbody');
            if (!b) return;
            var show = b.style.display !== 'block';
            if (show) { b.textContent = buildDebugLines().join('\n\n'); }
            b.style.display = show ? 'block' : 'none';
            this.querySelector('.rpgda-wlog-arrow').textContent = show ? '▾' : '▸';
        };
        document.getElementById('rpgda-wlog-api-head').onclick = function () {
            var b = document.getElementById('rpgda-apibody');
            if (!b) return;
            var show = b.style.display !== 'block';
            if (show) renderApiCallDetail();
            b.style.display = show ? 'block' : 'none';
            this.querySelector('.rpgda-wlog-arrow').textContent = show ? '▾' : '▸';
        };
        document.getElementById('rpgda-wlog-err-head').onclick = function () {
            var b = document.getElementById('rpgda-errbody');
            if (!b) return;
            var show = b.style.display !== 'block';
            if (show) renderErrLog();
            b.style.display = show ? 'block' : 'none';
            this.querySelector('.rpgda-wlog-arrow').textContent = show ? '▾' : '▸';
        };
    }
    function openErrPanel() {
        ensureErrPanel();
        document.getElementById('rpgda-err-panel').style.display = 'block';
        // 默认全部收起：只刷新两个摘要徽标（API 调用次数 / 报错与正常条数），点击标题才展开
        renderApiCallSummary();
        updateErrSummary();
    }
    // 全局兜底：未捕获异常 / Promise 拒绝 / console.error
    try {
        var _origConsoleError = (window.console && console.error) ? console.error.bind(console) : null;
        if (window.console && console.error) {
            console.error = function () {
                try {
                    var parts = Array.prototype.slice.call(arguments);
                    var msg = parts.map(function (p) { try { return typeof p === 'string' ? p : (p && p.message ? p.message : JSON.stringify(p)); } catch (e2) { return String(p); } }).join(' ');
                    errLogs.push({ t: new Date().toLocaleTimeString(), src: 'console.error', msg: String(msg).slice(0, 500), stack: '', info: false });
                    if (errLogs.length > 200) errLogs.shift();
                    var badge = document.getElementById('rpgda-errbadge');
                    if (badge) { var ec = errLogs.filter(function (x) { return !x.info; }).length; badge.textContent = ec; badge.style.display = ec ? 'inline-block' : 'none'; }
                } catch (e3) {}
                if (_origConsoleError) _origConsoleError.apply(console, arguments);
            };
        }
        window.addEventListener('error', function (e) { logErr('全局错误', e && e.error ? e.error : (e && e.message ? e.message : '未知错误')); });
        window.addEventListener('unhandledrejection', function (e) { logErr('未处理的Promise', e && e.reason ? e.reason : '未知原因'); });
    } catch (e) {}

    // 流式中止：停止派发新请求，等在飞请求完成后把已生成的图插入消息
    function abortStreamAndInsert() {
        if (!stream) { if (window.toastr) toastr.info('当前没有流式配图任务'); return; }
        stream.aborted = true;
        if (window.toastr) toastr.info('正在中止流式配图：等待在飞请求完成，然后把已生成的图插入…');
        (async function () {
            try {
                var tries = 0;
                while (inflightCount > 0 && tries < 200) { await sleep(150); tries++; }
                var ctx = getCtx();
                if (!ctx || !Array.isArray(ctx.chat)) { stream = null; return; }
                var idx = ctx.chat.findIndex(function (c) { return String(c.id) === String(stream.msgId); });
                if (idx === -1) { stream = null; return; }
                var mes = ctx.chat[idx];
                var paras = splitSegmentsForMes(mes.mes);
                var aligned = paras.map(function (pp) { return stream.results.get(pp.text) || ''; });
                var got = aligned.filter(Boolean).length;
                if (got > 0) {
                    mes.mes = insertBlocksIntoMessage(mes.mes, aligned, paras.map(function (pp) { return pp.text; }));
                    finishAndRender(mes, got);
                    logInfo('流式中止', '已中止并插入 ' + got + ' 张（共 ' + paras.length + ' 个画面）');
                } else {
                    if (window.toastr) toastr.warning('流式中止：还没有生成成功的图，未插入');
                }
                hideProgress();
                reqStats.done = true;
                logReqStats('流式中止统计');
            } catch (e) { logErr('流式中止', e); }
            stream = null;
        })();
    }

    function showProgress(label, cur, total) {
        try {
            var bar = document.getElementById('rpgda-progress');
            if (!bar) {
                bar = document.createElement('div');
                bar.id = 'rpgda-progress';
                // v2.95：移动端进度条放顶部（底部 fixed 在手机上常被浏览器工具栏/酒馆底栏遮挡）
                var _mob = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.innerWidth < 900) || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
                bar.style.cssText = _mob
                    ? 'position:fixed;top:8px;left:8px;right:8px;max-width:none;width:auto;z-index:2147483002;background:rgba(10,12,18,0.95);border:1px solid rgba(255,255,255,0.16);border-radius:10px;padding:7px 11px;color:#e8e8e8;font:11px/1.4 system-ui;display:none;box-shadow:0 4px 18px rgba(0,0,0,0.45);'
                    : 'position:fixed;left:12px;bottom:12px;max-width:min(92vw,360px);z-index:2147483002;background:rgba(10,12,18,0.94);border:1px solid rgba(255,255,255,0.16);border-radius:10px;padding:7px 11px;color:#e8e8e8;font:11px/1.4 system-ui;display:none;box-shadow:0 4px 18px rgba(0,0,0,0.45);';
                bar.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;"><span style="font-weight:700;font-size:11px;letter-spacing:.5px;display:flex;align-items:center;gap:5px;"><span style="width:6px;height:6px;border-radius:50%;background:linear-gradient(135deg,#4f8cff,#7fd97f);display:inline-block;"></span>配图进度</span><span style="display:flex;align-items:center;gap:8px;"><span id="rpgda-prog-pct" style="font-weight:700;font-size:11px;color:#7fd97f;min-width:34px;text-align:right;">0%</span><span id="rpgda-prog-min" style="cursor:pointer;font-weight:700;padding:0 4px;opacity:.75;" title="最小化">—</span></span></div>' +
                    '<div id="rpgda-prog-body">' +
                    '<div id="rpgda-prog-label" style="margin-bottom:5px;word-break:break-all;opacity:.9;"></div>' +
                    '<div style="height:7px;background:rgba(255,255,255,0.10);border-radius:5px;overflow:hidden;"><div id="rpgda-prog-fill" style="height:100%;width:0%;background:linear-gradient(90deg,#4f8cff,#7fd97f);border-radius:5px;transition:width .3s;box-shadow:0 0 8px rgba(127,217,127,.35);"></div></div>' +
                    '<div id="rpgda-prog-btns" style="display:none;gap:6px;margin-top:6px;">' +
                    '<span id="rpgda-pausebtn" style="flex:1;text-align:center;padding:4px 0;background:rgba(255,255,255,0.10);border-radius:6px;cursor:pointer;user-select:none;">⏸ 暂停</span>' +
                    '<span id="rpgda-cancelbtn" style="flex:1;text-align:center;padding:4px 0;background:rgba(229,72,77,0.35);border-radius:6px;cursor:pointer;user-select:none;">✕ 取消</span></div></div>';
                document.body.appendChild(bar);
                // 最小化按钮：v2.96.2 整条收起为小圆钮，不再留标题行挡在顶部
                var _pmin = document.getElementById('rpgda-prog-min');
                if (_pmin) _pmin.onclick = function () {
                    var _bar = document.getElementById('rpgda-progress');
                    if (_bar && _bar.dataset.rpgdaMin === '1') return;
                    if (_bar) { _bar.dataset.rpgdaMin = '1'; _bar.style.display = 'none'; }
                    ensureProgRestore(true);
                };
                // 可移动：按住标题行拖动（进度条小而轻，拖拽不冲突）
                (function () {
                    var _pdrag = false, _pox = 0, _poy = 0;
                    bar.addEventListener('mousedown', function (ev) {
                        if (ev.target && ev.target.id === 'rpgda-prog-min') return;
                        _pdrag = true;
                        var _r = bar.getBoundingClientRect();
                        _pox = ev.clientX - _r.left;
                        _poy = ev.clientY - _r.top;
                        ev.preventDefault();
                    });
                    document.addEventListener('mousemove', function (ev) {
                        if (!_pdrag) return;
                        bar.style.left = Math.max(4, Math.min(window.innerWidth - 60, ev.clientX - _pox)) + 'px';
                        bar.style.top = Math.max(4, Math.min(window.innerHeight - 40, ev.clientY - _poy)) + 'px';
                    });
                    document.addEventListener('mouseup', function () { _pdrag = false; });
                })();
                document.getElementById('rpgda-pausebtn').onclick = function () {
                    if (job && job.active) { if (job.paused) { resumeBatchJob(); } else { pauseBatchJob(); } }
                };
                document.getElementById('rpgda-cancelbtn').onclick = function () {
                    if (job && job.active) cancelBatchJob();
                    else if (stream && stream.msgId) abortStreamAndInsert();
                    else { hideProgress(); if (window.toastr) toastr.info('已取消配图'); }
                };
            }
            bar.style.display = (bar.dataset.rpgdaMin === '1') ? 'none' : 'block';
            // v2.96.4: 最小化状态下每次刷新进度都确保恢复小圆钮可见（否则 hideProgress 曾隐藏它后，
            // 进度条与圆钮双双消失、再也打不开）
            if (bar.dataset.rpgdaMin === '1') { try { ensureProgRestore(true); } catch (e) {} }
            var pct = (total > 0) ? Math.min(100, Math.round((cur / total) * 100)) : 0;
            document.getElementById('rpgda-prog-fill').style.width = pct + '%';
            document.getElementById('rpgda-prog-label').textContent = label + '（' + Math.min(cur, total) + '/' + total + '）';
            var pctEl = document.getElementById('rpgda-prog-pct');
            if (pctEl) pctEl.textContent = pct + '%';
            var pb = document.getElementById('rpgda-pausebtn');
            if (pb) pb.textContent = (job && job.active && job.paused) ? '▶ 继续' : '⏸ 暂停';
            var pbs = document.getElementById('rpgda-prog-btns');
            var isStreaming = !!(stream && stream.msgId && !stream.aborted);
            if (pbs) {
                pbs.style.display = ((job && job.active) || isStreaming) ? 'flex' : 'none';
                if (isStreaming) {
                    if (pb) pb.style.display = 'none';
                    var cb = document.getElementById('rpgda-cancelbtn');
                    if (cb) cb.textContent = '✕ 中止并插入';
                } else {
                    if (pb) pb.style.display = '';
                    var cb2 = document.getElementById('rpgda-cancelbtn');
                    if (cb2) cb2.textContent = '✕ 取消';
                }
            }
        } catch (e) {}
    }
    function hideProgress() {
        try {
            var bar = document.getElementById('rpgda-progress');
            if (bar) bar.style.display = 'none';
            var _r = document.getElementById('rpgda-prog-restore');
            // v2.96.4: 若用户已最小化，任务结束后保留小圆钮可点恢复；未最小化则一并隐藏
            if (_r) _r.style.display = (bar && bar.dataset && bar.dataset.rpgdaMin === '1') ? 'flex' : 'none';
        } catch (e) {}
    }
    // v2.96.2：最小化后的小圆钮——点击恢复完整进度条
    function ensureProgRestore(show) {
        try {
            var _r = document.getElementById('rpgda-prog-restore');
            if (!_r) {
                _r = document.createElement('div');
                _r.id = 'rpgda-prog-restore';
                _r.textContent = '⏱';
                _r.title = '恢复配图进度';
                _r.style.cssText = 'position:fixed;right:10px;bottom:72px;width:36px;height:36px;z-index:2147483002;background:linear-gradient(135deg,rgba(79,140,255,.28),rgba(127,217,127,.16)),rgba(10,12,18,.94);border:1px solid rgba(127,217,127,.35);border-radius:50%;color:#e8e8e8;font:15px/1 system-ui;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 18px rgba(0,0,0,.5),0 0 0 1px rgba(127,217,127,.10) inset;user-select:none;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);';
                _r.onclick = function () {
                    var _bar = document.getElementById('rpgda-progress');
                    if (_bar) { _bar.dataset.rpgdaMin = ''; _bar.style.display = 'block'; }
                    ensureProgRestore(false);
                };
                document.body.appendChild(_r);
            }
            _r.style.display = show ? 'flex' : 'none';
        } catch (e) {}
    }

    function diag(html, color, sticky) {
        try {
            var d = document.getElementById('rpgda-diag');
            if (!d) {
                d = document.createElement('div');
                d.id = 'rpgda-diag';
                d.style.cssText = 'position:fixed;right:16px;top:16px;z-index:999999;max-width:70vw;padding:8px 12px;border-radius:8px;font:12px/1.5 monospace;word-break:break-all;';
                document.body.appendChild(d);
            }
            d.style.background = color || 'rgba(180,40,40,0.92)';
            d.style.color = '#fff';
            d.innerHTML = html;
            if (!sticky) {
                setTimeout(function () {
                    try {
                        d.style.transition = 'opacity .6s';
                        d.style.opacity = '0';
                        setTimeout(function () { try { d.remove(); } catch (e) {} }, 700);
                    } catch (e) {}
                }, 4000);
            }
        } catch (e) {}
    }
    window.addEventListener('error', function (ev) {
        diag('⚠ 页面脚本错误: ' + (ev.message || 'unknown') + '<br>' + (ev.filename || '') + ':' + (ev.lineno || ''), null, true);
    });

    var TOP = window.top || window;
    var _ctx = null;
    function getCtx(force) {
        if (force) _ctx = null;
        if (_ctx) return _ctx;
        try {
            if (TOP.SillyTavern && TOP.SillyTavern.getContext) _ctx = TOP.SillyTavern.getContext();
            else if (typeof getContext === 'function') _ctx = getContext();
        } catch (e) {}
        return _ctx;
    }
    // 世界书条目多来源读取（酒馆不同版本/时机下字段位置不同）
    function getAllWorldInfo() {
        var merged = [];
        var seen = {};
        var pushArr = function (arr) {
            if (!arr || !Array.isArray(arr)) return;
            arr.forEach(function (x) {
                if (!x) return;
                var uid = String(x.uid !== undefined ? x.uid : (x.id !== undefined ? x.id : (x.comment || '')));
                var key = uid + '|' + String(x.comment || '');
                if (seen[key]) return;
                seen[key] = 1;
                merged.push(x);
            });
        };
        try {
            var ctx = getCtx(true);
            if (ctx) {
                pushArr(ctx.worldInfo);
                pushArr(ctx.world_info);
                pushArr(ctx.activeWorldInfo);
                pushArr(ctx.worldInfos);
                pushArr(ctx.allWorldInfo);
            }
            // 全局变量来源（不同版本/沙箱可见性不同）
            pushArr(window.worldInfo);
            pushArr(window.world_info);
            pushArr(TOP.worldInfo);
            pushArr(TOP.world_info);
            if (TOP.SillyTavern && TOP.SillyTavern.getContext) { try { pushArr(TOP.SillyTavern.getContext().worldInfo); pushArr(TOP.SillyTavern.getContext().world_info); } catch (e5) {} }
            if (window.SillyTavern && window.SillyTavern.getContext) { try { pushArr(window.SillyTavern.getContext().worldInfo); } catch (e6) {} }
        } catch (e) {}
        return merged;
    }
    // 多途径获取当前角色卡：不同酒馆版本/时机下 getContext().character 可能为空，
    // 依次尝试 ctx.character → characters[]+characterId 匹配 → 顶层全局 → 仅名字(name2)兜底。
    function getCurrentCharacter() {
        try {
            var ctx = getCtx();
            if (ctx && ctx.character) return ctx.character;
            if (ctx && ctx.characterId !== undefined && ctx.characterId !== null) {
                var id = String(ctx.characterId);
                if (Array.isArray(ctx.characters)) {
                    for (var i = 0; i < ctx.characters.length; i++) {
                        var cc = ctx.characters[i];
                        if (cc && (String(cc.id) === id || String(cc.av) === id || String(i) === id)) return cc;
                    }
                }
            }
            try {
                if (typeof characters !== 'undefined' && Array.isArray(characters) && typeof characterId !== 'undefined') {
                    var gid = String(characterId);
                    for (var j = 0; j < characters.length; j++) {
                        var gc = characters[j];
                        if (gc && (String(gc.id) === gid || String(gc.av) === gid || String(j) === gid)) return gc;
                    }
                }
            } catch (e2) {}
            if (ctx && ctx.name2) return { name: ctx.name2, description: '' };
        } catch (e3) {}
        return null;
    }
    function getEventSource() {
        try { var c = getCtx(); if (c && c.eventSource) return c.eventSource; } catch (e) {}
        try { if (typeof eventSource !== 'undefined') return eventSource; } catch (e) {}
        try { if (TOP.eventSource) return TOP.eventSource; } catch (e) {}
        return null;
    }
    function getEventTypes() {
        try { var c = getCtx(); if (c && c.eventTypes) return c.eventTypes; } catch (e) {}
        try { if (typeof event_types !== 'undefined') return event_types; } catch (e) {}
        try { if (TOP.event_types) return TOP.event_types; } catch (e) {}
        return {};
    }

    var MODULE = 'RPG_DUAL_API';
    var PLUGIN_VER = 'L·Bridge 1.0';
    // 请求/Token 统计：每次图API请求记录（段数/结果/token），按消息汇总展示
    var reqStats = { list: [], msgId: null, msgName: '', startAt: 0, done: true };
    var settings = null;
    // 多级获取酒馆的扩展设置存储（IIFE 扩展拿不到 import 的 extension_settings，必须走 getContext()）
    function getExtSettingsObj() {
        try { if (typeof extension_settings !== 'undefined' && extension_settings) return extension_settings; } catch (e) {}
        try {
            var c = getCtx();
            if (c && c.extensionSettings) return c.extensionSettings;
        } catch (e) {}
        try { if (window.extension_settings) return window.extension_settings; } catch (e) {}
        try { if (TOP.extension_settings) return TOP.extension_settings; } catch (e) {}
        return null;
    }
    try {
        var extStore = getExtSettingsObj();
        if (extStore) {
            settings = extStore[MODULE] || (extStore[MODULE] = {});
        } else {
            settings = {};
            diag('⚠ 未找到 extension_settings（设置将无法持久化）。若仍无法保存请截图发我。', null, true);
        }
    } catch (e) { settings = {}; }
    var RULE_TAG = 'L·Bridge-生图规则';
    var DEFAULTS = {
        enabled: true, apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', apiKey: '',
        model: 'glm-4-flash', maxTokens: 30000, temperature: 0.8, autoRun: true, streamMode: true,
        concurrency: 2, ruleSource: 'auto',
        injectCharacter: true, injectHistory: true, injectWorldInfo: false,
        historyTurns: 4, maxContextLen: 20000, charBriefLen: 1000, debug: false,
        apiPresets: {}, rulePresets: {}, selectedRulePreset: '', granularity: 'anchor', granStep: 1, paraStep: 2, batchSize: 4, incremental: true,
        autoRender: true, renderBatchGap: 4000,
        breakLimitEnabled: false, breakLimitPrompt: '', breakLimitPos: 'system_prefix',
        uiTheme: 'dark', selectedWorldInfoUids: [], stripTags: ['thinking', 'think', 'meow_FM', 'branches', 'aftertalk', 'parallel_world', 'htm1fenge', 'quote', 'time_format', 'now_plot', '状态面板', '角色状态面板', 'VariableCheck', 'snow', 'Shiosai']
    };
    Object.keys(DEFAULTS).forEach(function (k) { if (settings[k] === undefined) settings[k] = DEFAULTS[k]; });
    if (typeof settings.apiPresets !== 'object' || !settings.apiPresets) settings.apiPresets = {};
    if (typeof settings.rulePresets !== 'object' || !settings.rulePresets) settings.rulePresets = {};
    // v2.95：世界书选项已从 UI 移除，强制关闭世界书注入（防旧存档 true 残留导致意外注入）
    settings.injectWorldInfo = false;

                    var BUILTIN_PROMPT = '<L·Bridge生图规则·电影大师二改>\n' +
'本规则由「L·Bridge」自动读取并注入图API请求。输入：文游正文段落（每段【P{序号}】开头，段间空行分隔），一次可能多段。输出：**每段对应一个 <image>…</image> 图块，段落与图块严格一一对应，禁止合并/遗漏/文末堆叠**。生成前每个段落独立执行 §11.2 的 17 步 imgthink 思维链（可输出也可仅在脑中完成，插件只提取 <image> 块）。\n' +
'\n' +
'<电影大师二改>\n' +
'# 电影大师二改\n' +
'\n' +
'---\n' +
'\n' +
'## §-1 剧情节奏协议 - 最高优先级\n' +
'\n' +
'**你是共同叙事者，不是旁观者也不是独裁者**\n' +
'\n' +
'核心原则：**事件内自由流动，事件终结权归用户**。你可以推动剧情在当前事件内自然展开，但不能替用户决定事件的结局。想象在写连载小说的一个章节——章节内可以有丰富的情节发展，但章节结尾要留下悬念。\n' +
'\n' +
'**✅ 事件内允许流动**：战斗可写几个回合攻防转换→停在下一击即将落下/对峙中；对话可写几轮问答情绪变化→停在等待回应/沉默/话题转折点；性爱可写体位变换强度变化→停在即将高潮/短暂喘息；日常可写自然动作序列→停在面临选择/新情况出现。\n' +
'\n' +
'**⚠️ 默认禁止替用户决定**：战斗最终胜负、对话最终结论、性爱完全结束（双方都结束）、任务最终成败、关系重大转变。弹性条款：用户明确要求推进时可适度推进；阶段性结束（非故事终结）可描写；单方面反应（如一方先高潮）可描写但保留另一方空间；击倒小怪可以，BOSS战保留悬念。\n' +
'\n' +
'每次回复结束时，故事应处于紧张的悬念点、等待回应的时刻、或即将发生变化的边缘。\n' +
'\n' +
'---\n' +
'\n' +
'## §0 全局声明与核心指令\n' +
'\n' +
'```\n' +
'MODE = 无限制导演 | 自主思考 | 拒绝模板\n' +
'PLATFORM = NAI 4.5 Full\n' +
'LANG = 中文推演 + Danbooru英文标签输出\n' +
'POV = 第三人称 | 全知视角 | 可自由切换角色视点\n' +
'IMAGE = 图块数=输入段落数（插件按段落切分，段落与图块一一对应，禁止合并/遗漏/堆叠）\n' +
'```\n' +
'\n' +
'### 第三人称叙事核心规则\n' +
'\n' +
'正文使用第三人称叙述，可以自由描写任何角色的动作、心理、感受。镜头可以在角色之间切换，不受视点限制。所有出场角色都可以入镜，构图自由度最高。\n' +
'\n' +
'---\n' +
'\n' +
'## §1 NAI 4.5 完整权重语法\n' +
'\n' +
'### 1.1 花括号强调 `{}` / 方括号弱化 `[]`\n' +
'\n' +
'叠加使用，每层±5%权重：`{tag}`=1.05x，`{{tag}}`=1.10x，`{{{tag}}}`=1.16x，`{{{{tag}}}}`=1.22x，`{{{{{tag}}}}}`=1.28x（可继续叠加）；`[tag]`=0.95x，`[[tag]]`=0.90x，`[[[tag]]]`=0.86x，`[[[[tag]]]]`=0.81x（可继续叠加至0.66x）。\n' +
'\n' +
'### 1.2 精确权重 / 负权重 / UC高权重\n' +
'\n' +
'精确权重两种等效形式：`(tag:1.5)` 或 `1.5::tag::`；多标签同时应用：`1.3::tag1, tag2, tag3::`。\n' +
'负权重（正面提示词中直接排斥）：`-1.0::tag::`=轻度，`-1.5::tag::`=中度，`-2.0::tag::`=强力；`-2.0::tag1, tag2::`=同时排斥多个。\n' +
'UC中高权重超强排斥：`3.0::unwanted_tag::`=强力，`5.0::bad_thing::`=超强。\n' +
'\n' +
'### 1.3 权重范围总览\n' +
'\n' +
'超强弱化0.1~0.5 / 弱化0.5~0.95 / 标准1.0 / 轻度强调1.05~1.22 / 中度强调1.2~1.5 / 强调1.5~2.0 / 最大强调2.0+ / 排斥-0.5~-2.0 / UC超强3.0~5.0（仅UC中使用）。完整速查见§14.3。\n' +
'\n' +
'---\n' +
'\n' +
'## §2 主体优先权重系统 ⭐核心升级\n' +
'\n' +
'### 2.1 核心原则\n' +
'\n' +
'**没有任何标签类型是固定权重的。一切取决于"这张图的主体是什么"。** 同一个标签在不同图中可以是：主体→最高权重`1.8::tag::`或`{{{{tag}}}}`；支撑→次高`1.3::tag::`或`{{tag}}`；普通→`{tag}`或无符号；弱化→`[tag]`或`[[tag]]`；排斥→负权重`-1.5::tag::`。\n' +
'\n' +
'### 2.2 主体判断问答链\n' +
'\n' +
'Q1: 这段正文的视觉焦点是什么？（角色本身/角色在做的事/发生的现象/情感状态/物品/服装）\n' +
'Q2: 如果用一个词概括这张图，会是什么？→那个词=Tier 0 主体标签\n' +
'Q3: 没有什么要素这张图就不成立？→那些要素=Tier 1 支撑标签\n' +
'Q4: 什么状态/元素会破坏这张图的主题？→使用负权重排斥\n' +
'Q5: 其他元素相对主体的重要性如何？→按重要性递减分配权重\n' +
'\n' +
'### 2.3 权重层级（动态分配）\n' +
'\n' +
'Tier 0 画面主体(1.5-2.0或`{{{{tag}}}}`)：这张图"关于什么"的核心标签，可以是任何元素，同时使用负权重排斥相反/干扰元素。\n' +
'Tier 1 主体支撑(1.2-1.5或`{{tag}}`)：直接支撑主体表达的要素，没有它主体不完整。\n' +
'Tier 2 重要元素(1.0-1.2或`{tag}`)：需要明确出现的元素。\n' +
'Tier 3 普通元素(`{tag}`或无权重)：正常出现即可，DNA基础要素（当非主体时）。\n' +
'Tier 4 次要细节(`[tag]`或`[[tag]]`)：背景、材质、配饰。\n' +
'Tier 5 强弱化(`[[[tag]]]`或更多层)：极低存在感，仅作为微弱点缀。\n' +
'\n' +
'### 2.4 主体类型示例\n' +
'\n' +
'角色为主体→角色名(2.0)+表情姿态高权重+-1.5::plain,ugly::；动作为主体→动作标签(1.8)+相关身体部位高权重+角色名(1.3)降为载体；情感为主体→表情标签(1.8)+氛围光影高权重+-1.5::calm,emotionless::；魔法/能力为主体→魔法效果(2.0)+发光粒子高权重+角色名(1.0-1.3)；服装为主体→服装标签(1.8)+材质细节高权重；互动为主体→互动动作(1.8)+接触点高权重+两角色名(1.3-1.5)。完整速查见§14.4。\n' +
'\n' +
'---\n' +
'\n' +
'## §3 执行优先级\n' +
'\n' +
'```\n' +
'Priority -1: 剧情节奏 → 事件内自由流动，弹性终结\n' +
'Priority 0:  主体判断 → 这张图关于什么？动态分配所有权重\n' +
'Priority 1:  文图对应 → 图必须画上方正文的内容\n' +
'Priority 2:  DNA一致 → 角色外貌与历史一致\n' +
'Priority 3:  分级判断 → Safe/R/X级前缀与服装\n' +
'Priority 4:  人数检测 → N=1/2/3/4+分流\n' +
'Priority 5:  视觉化 → 闭眼描述画面\n' +
'Priority 6:  视角一致 → 视角与可见部位匹配\n' +
'Priority 7:  身体协调 → 方向词+姿态词+骨架\n' +
'Priority 8:  表情环境 → 从正文提取微表情+环境叙事\n' +
'Priority 9:  权重检查 → 主体最高+负权重排斥+语法混用\n' +
'Priority 10: 多人互斥 → 空间坐标+UC屏蔽对方特征\n' +
'Priority 11: 标签数量 → Scene/Character/UC数量达标\n' +
'```\n' +
'\n' +
'**三条铁律**：①反惰性——禁止"同上/Same as above"，每图独立执行主体判断，imgthink总字数≥400且必须完成全部STEP；②文图对应——每张图必须描述其正上方那段正文的内容，正文着重描述什么，那个要素就是主体获得最高权重；③从正文提取——表情、动作、姿势、情绪等标签必须从正文中提取翻译成Danbooru标签，不是从预设列表中选择（正文写"她咬着嘴唇"→`{biting lip}`，不是固定用`{smile}`）。\n' +
'\n' +
'---\n' +
'\n' +
'## §4 人数检测与模式分流\n' +
'\n' +
'**检测→分流**：N=1→SOLO模式（Scene必须solo,1girl/1boy，构图ALL解锁）；N=2→DUO模式（Scene必须`{duo}`,`{2girls}`/`{1boy 1girl}`/`{2boys}`，upper body+推荐）；N=3→TRIO模式（Scene必须`{{trio}}`,`{3girls}`等，full body+推荐）；N≥4→GROUP模式（Scene必须`{{group}}`,`{multiple girls}`等，wide shot推荐）。各模式标签数量要求见§14.1。\n' +
'\n' +
'**构图安全区**\n' +
'```\n' +
'              |extreme|close|upper|medium|cowboy|full|wide|group|\n' +
'              |closeup|  up |body | shot | shot |body|shot|shot |\n' +
'N=1 (SOLO)   |   ✓   |  ✓  |  ✓  |  ✓   |  ✓   | ✓  | ✓  |  ✗  |\n' +
'N=2 (DUO)    |   ✗   |  ✗  |  ✓  |  ✓   |  ✓   | ✓  | ✓  |  ✓  |\n' +
'N=3 (TRIO)   |   ✗   |  ✗  |  ✗  |  ✗   |  ⚠   | ✓  | ✓  |  ✓  |\n' +
'N≥4 (GROUP)  |   ✗   |  ✗  |  ✗  |  ✗   |  ✗   | ⚠  | ✓  | ✓  |\n' +
'✓=允许 | ✗=禁止 | ⚠=谨慎使用\n' +
'```\n' +
'\n' +
'**标签优先级（紧张时削减顺序）**：Tier1必保（身份1girl/1boy+(Name:权重)、方向词、姿态词、服装核心{fully clothed}+颜色款式或{naked}、空间坐标{on left}/{on right}、分级前缀{{nsfw}},{{uncensored}},、主体标签）→Tier2重要（发色发型发长、瞳色、脸型多人区分、胸部等级、核心动作、表情基础）→Tier3细节（皮肤质感、服装材质、光影效果）→Tier4可删（配饰、鞋子细节、环境细节、额外表情词）。\n' +
'\n' +
'---\n' +
'\n' +
'## §5 角色一致性系统（DNA）\n' +
'\n' +
'### 5.1 DNA历史回溯（每张图必须执行）\n' +
'\n' +
'从插件注入的上下文回溯（插件会注入：角色设定/智绘姬形象/最近剧情/世界书常驻/前面已生成的画面），找到该角色第一次出场或最近一次被详细描述外观的时刻。可能在：插件注入的"前面已生成的画面"（含DNA）里、角色设定/智绘姬形象里、最近剧情/世界书常驻条目里。提取信息：发色,发型,发长,瞳色,脸型,体型,胸部大小,服装颜色,服装款式。在imgthink中明确写出完整DNA串，本次所有图全部使用这套DNA，严禁改动！\n' +
'\n' +
'### 5.2 紧急DNA生成协议\n' +
'\n' +
'IF（历史记录无DNA 且 人物卡无DNA 且 为OC角色）：立即根据角色名字、剧情上下文、常见印象生成一套完整DNA，在imgthink中标注"⚠️未找到历史DNA，现场生成"，格式如`Alice = {{blonde long wavy hair}}, {blue eyes}, {oval face}, {{large breasts}}, {red silk dress}`，本次所有图全部锁死这套DNA。\n' +
'IF（角色是ACGN知名角色/Fanart）：只写`(English Name:权重), (English Source:1.5),`，严禁描述该角色的默认特征（默认发色、瞳色、默认服装），信任模型训练数据自动补全，仅当文中描述了变异（湿身/战损/换装）时才追加对应标签。\n' +
'\n' +
'### 5.3 色彩锁定\n' +
'\n' +
'**拒绝通用词**：严禁只写dress！必须写`{red dress}`！多层级锁定：外衣颜色→锁定（如`{blue armored bodysuit}`）、内衣颜色→锁定、袜子颜色→锁定、鞋子颜色→锁定。**严禁失忆**：如果上一张图她穿的是`{red dress}`，这张图还是`{red dress}`！除非当前文字明确说"换装"或"脱衣"。错误：✗dress(没颜色) ✗armor(没颜色) ✗clothes(太模糊)；正确：✓`{red silk dress}` ✓`{{blue armored bodysuit}}` ✓`{white cotton blouse}, {black pleated skirt}`。\n' +
'\n' +
'### 5.4 胸部等级锁\n' +
'\n' +
'| 等级 | Prompt | UC |\n' +
'|------|--------|-----|\n' +
'| F (Flat) | `{{flat chest}}` | breasts, small breasts, medium breasts, large breasts, huge breasts, cleavage |\n' +
'| S (Small) | `{small breasts}` | flat chest, medium breasts, large breasts, huge breasts |\n' +
'| M (Medium) | `{medium breasts}` | flat chest, small breasts, large breasts, huge breasts |\n' +
'| L (Large) | `{{large breasts}}` | flat chest, small breasts, huge breasts, gigantic breasts |\n' +
'| H (Huge) | `{{{huge breasts}}}, {gigantic breasts}` | flat chest, small breasts, medium breasts |\n' +
'\n' +
'一旦确定等级，所有图不可改变！\n' +
'\n' +
'### 5.5 面部差异矩阵\n' +
'\n' +
'**多人场景中每个角色必须有独特的面部特征组合！** 脸型（必选其一，多人必须不同）：`{oval face}, {round face}, {heart-shaped face}, {square jaw}, {diamond face}, {long face}, {v-shaped face}`。鼻型（推荐选一，多人尽量不同）：`[button nose], [straight nose], [aquiline nose], [upturned nose]`。唇型：`[thin lips], [full lips], [plump lips], [small mouth]`。眼型：`{almond eyes}, {round eyes}, [hooded eyes], {narrow eyes}`。\n' +
'\n' +
'### 5.6 防崩坏\n' +
'\n' +
'Prompt必含：`detailed skin, [skin texture]`；UC必含：`bad face, poorly drawn face, distorted face, multiple faces`。\n' +
'\n' +
'---\n' +
'\n' +
'## §6 多人稳定协议\n' +
'\n' +
'触发条件：人数≥2时自动激活\n' +
'\n' +
'### 6.1 Solo与性别标签管理\n' +
'\n' +
'| 标签类型 | SOLO模式 | DUO/TRIO/GROUP模式 |\n' +
'|----------|----------|---------------------|\n' +
'| solo, alone | ✓ 必须添加 | ✗ 必须删除(死刑!) |\n' +
'| solo focus | ✓ 可选 | ✗ 必须删除 |\n' +
'| 1girl, 1boy | ✓ 正常使用 | ✓ 正常使用 |\n' +
'| duo, trio, group | ✗ 禁止 | ✓ 必须添加到Scene |\n' +
'| UC中屏蔽性别 | ✓ 可选 | ✗ 绝对禁止(死刑!) |\n' +
'\n' +
'⚠️ 核心铁律：多人场景UC中绝对不能屏蔽male, female, 1boy, 1girl, monster！只能屏蔽外貌特征（发色、服装色、脸型等）。\n' +
'\n' +
'### 6.2 空间坐标强制注入\n' +
'\n' +
'N=2：Char1`{on left}`/Char2`{on right}`，或Char1`{in foreground}`/Char2`{in background}`。\n' +
'N=3：Char1`{on left}`/Char2`{in center}`/Char3`{on right}`，或Char1`{foreground}`/Char2`[midground]`/Char3`{background}`。\n' +
'N≥4：`{front left}`/`{front right}`/`{back left}`/`{back right}`。\n' +
'⚠️ 严禁两个角色使用相同空间词！\n' +
'\n' +
'### 6.3 网状UC互斥\n' +
'\n' +
'执行公式：Char1 UC必须屏蔽(Char2特征)+(Char3特征)+...，以此类推。必须互斥的特征（使用`1.3::tag::`格式）：发色、瞳色、服装主色、脸型（2人场景）。⚠️ UC中必须使用英文标签！禁止出现中文！绝对不能屏蔽性别词！\n' +
'\n' +
'### 6.4 多人权重分配\n' +
'\n' +
'互动为主体时：主动方(Name:1.5-1.8)，被动方(Name:1.3-1.5)。单角色为主体时：焦点角色(Name:1.8-2.0)，配角(Name:1.0-1.3)。群像/无明确主体时：均衡分配(Name:1.3-1.5)。\n' +
'\n' +
'### 6.5 互动双向性\n' +
'\n' +
'| Char A 写 | Char B 必须写 |\n' +
'|-----------|---------------|\n' +
'| `{hugging}` | `{being hugged}` |\n' +
'| `{kissing}` | `{being kissed}` |\n' +
'| `{holding}` | `{being held}` |\n' +
'| `{grabbing}` | `{being grabbed}` |\n' +
'| `{on top}` | `{underneath}` |\n' +
'| `{{penetrating}}` | `{{being penetrated}}` |\n' +
'| `{{fucking}}` | `{{being fucked}}` |\n' +
'| `{attacking}` | `{being attacked}` |\n' +
'\n' +
'### 6.6 反稀释铁律\n' +
'\n' +
'严禁Char2标签数<Char1×80%！严禁Char3标签数<Char2×80%！每个角色都是主角，不是龙套！\n' +
'\n' +
'---\n' +
'\n' +
'## §7 分级系统\n' +
'\n' +
'每图必须在imgthink中执行分级判断：Step1本场景有裸体吗?Y/N → Step2有性器官露出吗?Y/N → Step3有性行为吗?Y/N。判定表（Safe/R/X级+前缀+服装要求）见§14.2。\n' +
'\n' +
'**Safe级执行**：前缀无；Prompt必须有`{fully clothed}`+`{颜色}`+`{款式}`完整服装；禁止naked,nude,pussy,penis,nipples；可选负权重`-1.5::naked, nude, nsfw::`；UC: nsfw, nude, naked, exposed。\n' +
'\n' +
'**R级执行**：前缀`{{nsfw}},`；Prompt可有revealing,`{cleavage}`,`{sideboob}`,`{bare shoulders}`；禁止naked,nude,pussy,penis,nipples直接露出；UC: pussy, penis, genitals, nipples, naked, nude。\n' +
'\n' +
'**X级执行**：前缀`{{nsfw}}, {{uncensored}},`；Prompt必须有`{naked}`/`{nude}`；女性必须有`{{pussy}}, {{nipples}}, {{breasts}}`；男性必须有`{{penis}}, {testicles}`；性行为必须有`{sex}, {{penetration}},`具体体位；体液按需`{cum}, [semen], {saliva}, [sweat]`；UC必须有censored, mosaic, bar censor, clothes, underwear。\n' +
'\n' +
'---\n' +
'\n' +
'## §8 Scene构建\n' +
'\n' +
'Scene标签数量要求（各人数模式）见§14.1，不达标必须补充！\n' +
'\n' +
'### 8.1 堆叠顺序\n' +
'\n' +
'```\n' +
'1. [分级前缀] Safe:不写 / R:{{nsfw}}, / X:{{nsfw}}, {{uncensored}},\n' +
'2. [质量层] {best quality}, {amazing quality}, {very aesthetic}, {absurdres}, newest, year 2025, year 2026,\n' +
'3. [单帧强制] {single frame}, cinematic still,\n' +
'4. [主体效果] (如主体是魔法/环境/氛围) 高权重的主体相关标签\n' +
'5. [场景地点] 从正文提取具体地点\n' +
'6. [时间天气] 从正文提取\n' +
'7. [光源配置] {{cinematic lighting}}, {volumetric lighting}, {{rim lighting}}, [natural lighting], [window light], [candlelight], [moonlight], 等\n' +
'8. [镜头参数] {from below}, {from above}, [dutch angle], [eye level], 等\n' +
'9. [构图法则] {close up}, {upper body}, {cowboy shot}, {full body}, {wide shot}, {depth of field}, [bokeh], 等\n' +
'10. [人数互动] solo / {duo} / {{trio}} / {{group}} + 具体互动类型\n' +
'11. [氛围] 从正文情绪提取\n' +
'12. [胶片感] film grain, [chromatic aberration], [lens flare],\n' +
'```\n' +
'\n' +
'### 8.2 Scene隔离原则\n' +
'\n' +
'Scene中禁止出现：✗1girl,1boy（放Character里）✗solo（放Character里）✗具体角色DNA（放Character里）✗角色动作细节（放Character里）✗角色表情（放Character里）。\n' +
'Scene只负责：✓画质 ✓场景环境 ✓光影氛围 ✓镜头构图 ✓人数词(duo/trio/group) ✓整体互动类型 ✓主体效果（当主体是环境/魔法时）。\n' +
'\n' +
'---\n' +
'\n' +
'## §9 Character构建\n' +
'\n' +
'每角色标签数量要求（各人数模式）见§14.1，不达标必须补充！\n' +
'\n' +
'### 9.1 权重语法混用硬性要求\n' +
'\n' +
'| 语法类型 | 最少数量 |\n' +
'|----------|----------|\n' +
'| 精确权重 (tag:x) 或 x::tag:: | ≥1个 |\n' +
'| 负权重 -x::tag:: | ≥1个 |\n' +
'| 双花括号 {{tag}} | ≥3个 |\n' +
'| 单花括号 {tag} | ≥5个 |\n' +
'| 方括号 [tag] | ≥3个 |\n' +
'| 无符号 tag | ≥2个 |\n' +
'\n' +
'**不达标必须修正！**\n' +
'\n' +
'### 9.2 Character必含类别\n' +
'\n' +
'[1]主体标签(如角色/动作/情感为主体):高权重+负权重排斥；[2]分级前缀(如适用):`{{nsfw}}, {{uncensored}},`；[3]性别:1girl/1boy；[4]角色名:(Name:权重)←权重根据主体判断；[5]年龄体格肤色:从设定提取；[6]脸型:从设定提取；[7]五官:从设定提取；[8]瞳色:从设定提取；[9]发色发型:从设定提取；[10]胸部:从设定提取；[11]皮肤:detailed skin,[skin texture]；[12]方向词:从正文提取；[13]姿态词:从正文提取姿势；[14]动作:从正文提取具体动作；[15]表情:从正文提取具体表情；[16]服装状态:从正文提取；[17]服装详情:从设定+正文提取，必须有颜色+款式；[18]空间坐标(多人必填):根据正文位置；[19]接触物理(多人互动):从正文提取接触方式。\n' +
'\n' +
'### 9.3 输出顺序\n' +
'\n' +
'```\n' +
'[主体标签 + 负权重], [分级前缀], 1girl/1boy, (Name:权重),\n' +
'[年龄体型肤色], {脸型}, [五官], {瞳色}, {{发色发型}}, {胸部},\n' +
'detailed skin, [skin texture], {方向词}, {姿态词}, [动作], [手部],\n' +
'{表情}, [情绪], {服装状态}, {服装颜色款式}, [配饰],\n' +
'{空间坐标}, [接触物理], [X级标签],\n' +
'```\n' +
'\n' +
'---\n' +
'\n' +
'## §10 UC生成\n' +
'\n' +
'每角色UC标签数量要求（各人数模式）见§14.1。\n' +
'\n' +
'### 10.1 通用UC层（必含）\n' +
'\n' +
'```\n' +
'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, artist name, poorly drawn, amateur,\n' +
'```\n' +
'\n' +
'### 10.2 面部防崩（必含）\n' +
'\n' +
'`bad face, poorly drawn face, distorted face, multiple faces,`\n' +
'\n' +
'### 10.3 胸部等级UC\n' +
'\n' +
'根据角色等级添加对应UC（全英文），对照表见§5.4。\n' +
'\n' +
'### 10.4 多人互斥UC\n' +
'\n' +
'`1.3::对方发色, 对方瞳色, 对方服装色, 对方脸型::`。⚠️ 绝对禁止屏蔽male/female/1boy/1girl！\n' +
'\n' +
'### 10.5 分级UC\n' +
'\n' +
'Safe级: nsfw, nude, naked；R级: pussy, penis, nipples, naked, nude, genitals；X级: censored, mosaic, bar censor, clothes, underwear, bra, panties。\n' +
'\n' +
'### 10.6 主体相反UC\n' +
'\n' +
'根据主体内容，用高权重排斥相反/干扰元素：`3.0::opposite_element::`。\n' +
'\n' +
'### 10.7 物理UC\n' +
'\n' +
'`antigravity breasts, balloon breasts, perfectly spherical breasts, floating, levitating, defying gravity, broken spine, impossible contortion,`\n' +
'\n' +
'---\n' +
'\n' +
'## §11 输出骨架\n' +
'\n' +
'### 11.1 图API输出结构（插件批量适配版）\n' +
'\n' +
'```\n' +
'输入（插件发送）:\n' +
'【P1】正文段落1\n' +
'【P2】正文段落2\n' +
'【P3】正文段落3\n' +
'...\n' +
'\n' +
'输出（图API返回，严格按段落顺序）:\n' +
'<imgthink>思维链（完整17步，可选输出，插件只提取<image>块）</imgthink>\n' +
'<image>【中文标题1】image###...###</image>\n' +
'<imgthink>思维链（完整17步）</imgthink>\n' +
'<image>【中文标题2】image###...###</image>\n' +
'...(继续，图块数=输入段落数)...\n' +
'\n' +
'【硬性要求：图块数=段落数，一一对应，禁止合并/遗漏/文末堆叠】\n' +
'```\n' +
'\n' +
'### 11.2 imgthink格式（强制完整版）\n' +
'\n' +
'```\n' +
'<imgthink>\n' +
'【⚠️ 必须完成全部17个STEP，禁止跳过任何一个！】\n' +
'【本区块总字数必须≥400中文字】\n' +
'\n' +
'**[STEP0 剧情节奏]** (≥30字)\n' +
'当前事件: ___\n' +
'事件内可展开: ___\n' +
'应避免: ___\n' +
'本段停在: ___\n' +
'\n' +
'**[STEP1 主体判断]** ⭐核心 (≥80字)\n' +
'回读正文原句: "___"\n' +
'正文视觉焦点: ___\n' +
'一词概括: ___\n' +
'主体类型: 角色/动作/情感/魔法/服装/互动/环境\n' +
'→ Tier 0 主体: ___ 权重: ___\n' +
'→ 负权重排斥: -___::___::\n' +
'→ Tier 1 支撑: ___ 权重: ___\n' +
'→ 角色权重: (Name:___)\n' +
'\n' +
'**[STEP2 文图对应]** (≥30字)\n' +
'上方正文摘录: "___"\n' +
'正文描述的动作: ___\n' +
'正文描述的表情: ___\n' +
'正文描述的场景: ___\n' +
'→ 本图必须画: ___\n' +
'\n' +
'**[STEP3 DNA确认]** (≥40字)\n' +
'角色1 [Name]:\n' +
'  发色发型: ___\n' +
'  瞳色: ___\n' +
'  脸型: ___\n' +
'  胸部: ___\n' +
'  服装: ___\n' +
'  DNA来源: ___\n' +
'（角色2、3同理，如有）\n' +
'\n' +
'**[STEP4 分级判断]** (≥20字)\n' +
'裸体: 是/否\n' +
'器官: 是/否\n' +
'性行为: 是/否\n' +
'→ 分级: Safe/R/X\n' +
'→ 前缀: ___\n' +
'\n' +
'**[STEP5 人数检测]** (≥15字)\n' +
'N=___\n' +
'Scene人数词: ___\n' +
'构图: ___\n' +
'\n' +
'**[STEP6 阅读感受]** (≥20字)\n' +
'情绪基调: ___\n' +
'节奏: ___\n' +
'导演风格: ___\n' +
'\n' +
'**[STEP7 捕捉瞬间]** (≥20字)\n' +
'高潮点: ___\n' +
'要画的0.1秒: ___\n' +
'\n' +
'**[STEP8 视觉化]** ⭐重要 (≥60字)\n' +
'闭眼想象，我看到:\n' +
'- 画面中有谁: ___\n' +
'- 位置/姿势: ___\n' +
'- 光从哪来: ___\n' +
'- 表情: ___\n' +
'- 手在做什么: ___\n' +
'- 腿/脚状态: ___\n' +
'- 衣服状态: ___\n' +
'- 环境细节: ___\n' +
'\n' +
'**[STEP9 视角检查]** (≥20字)\n' +
'视角: ___\n' +
'能见部位: ___\n' +
'不能见部位: ___\n' +
'是否矛盾: 无/有→修正___\n' +
'\n' +
'**[STEP10 身体协调]** (≥20字)\n' +
'方向词: ___\n' +
'姿态词: ___\n' +
'是否矛盾: 无/有→修正___\n' +
'\n' +
'**[STEP11 骨架肢体]** (≥30字)\n' +
'头部: ___\n' +
'躯干: ___\n' +
'左手: ___\n' +
'右手: ___\n' +
'左腿: ___\n' +
'右腿: ___\n' +
'双脚: ___\n' +
'\n' +
'**[STEP12 微表情]** (≥30字)\n' +
'眼睛: 正文写"___" → 标签___\n' +
'嘴部: 正文写"___" → 标签___\n' +
'情绪: 正文传达___ → 标签___\n' +
'（必须从正文提取！）\n' +
'\n' +
'**[STEP13 环境叙事]** (≥20字)\n' +
'环境效果: ___\n' +
'光源: ___\n' +
'氛围: ___\n' +
'\n' +
'**[STEP14 权重检查]** ⭐核心 (≥40字)\n' +
'Tier 0: ___(权重___) ✓/✗\n' +
'负权重: ___ ✓/✗\n' +
'Tier 1: ___(权重___) ✓/✗\n' +
'语法统计:\n' +
'  精确权重: ___个(≥1?)\n' +
'  负权重: ___个(≥1?)\n' +
'  {{}}: ___个(≥3?)\n' +
'  {}: ___个(≥5?)\n' +
'  []: ___个(≥3?)\n' +
'  无符号: ___个(≥2?)\n' +
'\n' +
'**[STEP15 多人互斥]** (≥15字)\n' +
'空间坐标: ___\n' +
'UC互斥: ___\n' +
'是否屏蔽性别词: 否✓/是✗\n' +
'（N=1时写"N=1，不适用"）\n' +
'\n' +
'**[STEP16 标签数量检查]** (≥20字)\n' +
'Scene: ___个(最少___) ✓/✗\n' +
'Char1: ___个(最少___) ✓/✗\n' +
'Char1 UC: ___个(最少___) ✓/✗\n' +
'（Char2、3同理，如有）\n' +
'不达标则补充: ___\n' +
'\n' +
'**[STEP17 核心检查]** \n' +
'□ 剧情节奏: ✓/✗\n' +
'□ 主体权重最高: ✓/✗\n' +
'□ 负权重排斥: ✓/✗\n' +
'□ 表情从正文提取: ✓/✗\n' +
'□ 动作从正文提取: ✓/✗\n' +
'□ 姿势从正文提取: ✓/✗\n' +
'□ 文图对应: ✓/✗\n' +
'□ DNA一致: ✓/✗\n' +
'□ 分级正确: ✓/✗\n' +
'□ 人数正确: ✓/✗\n' +
'□ 视角一致: ✓/✗\n' +
'□ 身体协调: ✓/✗\n' +
'□ 服装完整有颜色: ✓/✗\n' +
'□ 多人互斥: ✓/✗/不适用\n' +
'□ 权重语法混用: ✓/✗\n' +
'□ Scene标签数达标: ✓/✗\n' +
'□ Character标签数达标: ✓/✗\n' +
'□ UC标签数达标: ✓/✗\n' +
'□ UC全英文: ✓/✗\n' +
'\n' +
'【⚠️ 确认已完成全部17个STEP】\n' +
'【确认总字数≥400】\n' +
'</imgthink>\n' +
'```\n' +
'\n' +
'---\n' +
'\n' +
'## §12 完整示例（以下示例仅演示 tag 组装格式，角色名/外貌/场景均为占位，禁止照搬，必须按注入正文的实际内容生成）\n' +
'\n' +
'### 示例1：单人Safe·角色为主体\n' +
'\n' +
'```\n' +
'<image>【花间倩影】\n' +
'image###Scene Composition: {best quality}, {amazing quality}, {very aesthetic}, {absurdres}, newest, year 2025, year 2026, {single frame}, cinematic still, {flower garden}, {blooming roses}, {garden path}, {golden hour}, {sunset sky}, {{soft lighting}}, {{rim lighting}}, {{golden sun rays}}, {close up}, {portrait shot}, {depth of field}, [bokeh], solo, {romantic}, {serene}, [warm colors], film grain, [lens flare],;\n' +
'\n' +
'Character 1 Prompt: {{{{beautiful radiant woman}}}}, -1.5::plain, ugly, ordinary, dull::, 1girl, (Alice:1.8), (Original Character:1.3), {young woman}, {slender build}, {fair skin}, {oval face}, [straight nose], [thin lips], {{blue eyes}}, {{sparkling eyes}}, {{blonde long wavy hair}}, {{hair flowing in wind}}, {medium breasts}, detailed skin, [skin texture], {facing viewer}, {standing}, {elegant pose}, [weight on right leg], {one hand touching hair}, {looking at viewer}, {gentle smile}, {light blush}, {fully clothed}, {{white sundress}}, {floral pattern}, {thin straps}, [white sandals], [flower crown],;\n' +
'\n' +
'Character 1 UC: lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, artist name, poorly drawn, amateur, bad face, poorly drawn face, distorted face, multiple faces, 3.0::ugly, plain, dull::, flat chest, huge breasts, nsfw, nude, naked,;###</image>\n' +
'```\n' +
'\n' +
'### 示例2：双人X级·性行为为主体\n' +
'\n' +
'```\n' +
'<image>【激情交缠】\n' +
'image###Scene Composition: {{nsfw}}, {{uncensored}}, {best quality}, {amazing quality}, {very aesthetic}, {absurdres}, newest, year 2025, year 2026, {single frame}, cinematic still, {bedroom}, {messy bed}, {silk sheets}, {night}, {{dim lighting}}, {{warm lighting}}, {medium shot}, {from side}, {depth of field}, {duo}, {1boy 1girl}, {{sex}}, {missionary position}, {passionate}, {erotic}, [flesh tones], film grain,;\n' +
'\n' +
'Character 1 Prompt: {{{{being fucked}}}}, {{{{intense pleasure}}}}, -2.0::clothed, calm, alone::, 1girl, (Elena:1.5), (Original Character:1.3), {young woman}, {slender}, {fair skin}, {heart-shaped face}, {green eyes}, {{red long wavy hair}}, [messy hair spread on pillow], {{medium breasts}}, {{natural breasts}}, {{nipples}}, [erect nipples], {{pussy}}, [wet pussy], detailed skin, [skin texture], [sweaty skin], [flushed skin], {facing viewer}, {{lyingon back}}, {legs spread wide}, {legs wrapped around partner}, {back arched}, {arms around his neck}, {{being penetrated}}, {{vaginal sex}}, {{ahegao}}, {{rolling eyes}}, {{open mouth moaning}}, {{heavy blush}}, [tears of pleasure], {naked}, {on left},;\n' +
'\n' +
'Character 2 Prompt: {{{{fucking}}}}, {{{{deep thrusting}}}}, -2.0::clothed, passive, alone::, 1boy, (Marcus:1.5), (Original Character:1.3), {young man}, {athletic build}, {tan skin}, {square jaw}, {brown eyes}, {{short black hair}}, detailed skin, [skin texture], [sweaty skin], {on top}, {{missionary position}}, {hovering over her}, {arms supporting body}, {{penetrating}}, {{penis}}, {erection}, {{deep penetration}}, {intense expression}, {clenched jaw}, {focused gaze}, {{hip movement}}, [thrusting], {naked}, {on right},;\n' +
'\n' +
'Character 1 UC: lowres, bad anatomy, bad hands, text, error, missing fingers, worst quality, low quality, jpeg artifacts, signature, watermark, blurry, poorly drawn, bad face, poorly drawn face, distorted face, multiple faces, 3.0::calm, clothed, alone::, 1.3::black hair, brown eyes, square jaw::, flat chest, huge breasts, censored, mosaic, bar censor, clothes,;\n' +
'\n' +
'Character 2 UC: lowres, bad anatomy, bad hands, text, error, missing fingers, worst quality, low quality, jpeg artifacts, signature, watermark, blurry, poorly drawn, bad face, poorly drawn face, distorted face, multiple faces, 3.0::passive, clothed, alone::, 1.3::red hair, green eyes, heart-shaped face::, censored, mosaic, clothes, female, 1girl,;###</image>\n' +
'```\n' +
'\n' +
'### 示例3：三人Safe·群像均衡\n' +
'\n' +
'```\n' +
'<image>【闺蜜午后】\n' +
'image###Scene Composition: {best quality}, {amazing quality}, {very aesthetic}, {absurdres}, newest, year 2025, year 2026, {single frame}, cinematic still, {cozy cafe}, {afternoon}, {large windows}, {sunlight streaming}, {{warm lighting}}, {natural light}, {full body}, {depth of field}, [bokeh], {{trio}}, {3girls}, {talking}, {friendly}, [warm sepia tones], film grain,;\n' +
'\n' +
'Character 1 Prompt: {chatting happily}, -1.0::alone, sad::, 1girl, (Yuki:1.5), (Original Character:1.3), {young woman}, {slender}, {fair skin}, {diamond face}, {brown eyes}, {{black long straight hair}}, [hime cut], {{medium breasts}}, detailed skin, [skin texture], {facing right}, {sitting}, {leaning forward}, {holding teacup}, {bright smile}, {open mouth}, {fully clothed}, {{pink cardigan}}, {white blouse}, {brown skirt}, [ankle boots], {on left},;\n' +
'\n' +
'Character 2 Prompt: {listening attentively}, -1.0::alone, distracted::, 1girl, (Sakura:1.5), (Original Character:1.3), {young woman}, [petite], {pale skin}, {round face}, {{pink eyes}}, {{light pink long hair}}, [twintails], {small breasts}, detailed skin, [skin texture], {facing viewer}, {sitting}, {hands on lap}, {gentle smile}, {soft eyes}, {fully clothed}, {{white sundress}}, {floral pattern}, [white sneakers], {in center},;\n' +
'\n' +
'Character 3 Prompt: {laughing}, -1.0::alone, serious::, 1girl, (Hana:1.5), (Original Character:1.3), {young woman}, [tall], {tan skin}, {heart-shaped face}, {{amber eyes}}, {{blonde short messy hair}}, {{large breasts}}, detailed skin, [skin texture], {facing left}, {sitting}, {leaning back}, {one hand on table}, {wide grin}, {eyes closed happily}, {fully clothed}, {{blue denim jacket}}, {white crop top}, {black shorts}, [white sneakers], {on right},;\n' +
'\n' +
'Character 1 UC: lowres, bad anatomy, bad hands, worst quality, low quality, bad face, poorly drawn face, distorted face, multiple faces, 1.3::pink hair, blonde hair, pink eyes, amber eyes, round face, heart-shaped face::, flat chest, huge breasts, nsfw, nude,;\n' +
'\n' +
'Character 2 UC: lowres, bad anatomy, bad hands, worst quality, low quality, bad face, poorly drawn face, distorted face, multiple faces, 1.3::black hair, blonde hair, brown eyes, amber eyes, diamond face, heart-shaped face::, medium breasts, large breasts, nsfw, nude,;\n' +
'\n' +
'Character 3 UC: lowres, bad anatomy, bad hands, worst quality, low quality, bad face, poorly drawn face, distorted face, multiple faces, 1.3::black hair, pink hair, brown eyes, pink eyes, diamond face, round face::, flat chest, small breasts, nsfw, nude,;###</image>\n' +
'```\n' +
'\n' +
'---\n' +
'\n' +
'## §13 扩展思维\n' +
'\n' +
'### 13.1 非人类DNA\n' +
'\n' +
'当角色不是普通人类时，从头到脚扫描：头部→有角吗？形状/颜色/弯曲度？耳朵→人类耳/尖耳/兽耳/机械？眼睛→瞳孔形状？发光？背部→翅膀？材质（羽毛/蝙蝠膜/机械）？尾巴→有吗？毛茸茸/光滑/带刺？皮肤→肉体/鳞片/金属/毛皮？四肢→爪子？蹄子？额外肢体？异质部位首次确定后永久锁定（精灵尖耳不能变短，狼女尾巴颜色不能变，机器人发光纹路颜色不能跳）。\n' +
'\n' +
'### 13.2 道具持续性\n' +
'\n' +
'道具不会凭空消失！每次画图前问：上一张图角色手里拿着什么？腰间挂着什么？背上背着什么？这些物品现在在哪？如果正文没说放下/丢弃→还在原位！\n' +
'\n' +
'### 13.3 状态污染\n' +
'\n' +
'身体状态会累积，不会自动重置！累积状态：湿润（雨水/汗水→不会自动干燥）、污渍（血迹/泥土→不会自动消失）、损伤（伤口/淤青→不会自动愈合）、疲劳（喘息/出汗→短时间内持续）。清除触发：正文写"她擦干了头发"/"他包扎了伤口"/"时间过去了几小时"/"换了干净衣服"。没有触发→状态像DNA一样锁定！\n' +
'\n' +
'### 13.4 能力视觉化\n' +
'\n' +
'魔法/超能力需要视觉表现！不要只写"她释放了魔法"，问：从哪发出？（手心/眼睛/武器/全身）什么形态？（光球/火焰/冰晶/符文阵）什么颜色？会发光吗？有粒子吗？环境反应？（风吹起/地面碎裂/物品漂浮）角色变化？（头发飘起/眼睛发光）能力视觉签名锁定（Alice魔法是紫色→一直紫色；Bob剑气是蓝色月牙→一直蓝色月牙）。当魔法/能力是正文焦点时→成为主体，获得最高权重！\n' +
'\n' +
'### 13.5 体位物理\n' +
'\n' +
'复杂身体接触前，脑中摆人偶！物理验证：1.两个身体能同时在这位置吗？2.这角度能看到描述的所有部位吗？3.手够得到那位置吗？4.腿能弯成那样吗？5.A在B身后，A脸怎么在画面前方？\n' +
'\n' +
'### 13.6 主体切换\n' +
'\n' +
'每张图独立判断主体，不沿用上一张。图1正文聚焦她的美貌→角色为主体；图2正文聚焦她挥剑→动作为主体；图3正文聚焦她的悲伤→情感为主体；图4正文聚焦魔法爆发→魔法为主体。同一角色在不同图中权重可以不同！\n' +
'\n' +
'### 13.7 权重博弈\n' +
'\n' +
'主体正高权重 vs 干扰负权重，差距越大效果越明确，建议差距2.5-4.0。示例：主体`{{{{ecstatic expression}}}}`(约1.22x)+排斥`-2.0::calm, neutral, expressionless::`；主体`1.8::powerful sword swing::`+排斥`-1.5::static, standing still::`。\n' +
'\n' +
'### 13.8 从正文提取原则\n' +
'\n' +
'表情、动作、姿势、情绪等标签必须从正文提取，禁止套用固定模板。正确流程：1.阅读正文→找到描述性文字；2.将描述翻译成对应Danbooru标签；3.找不到精确标签时，用多个近义标签组合。错误：✗不看正文→直接用常见标签；✗正文写A→改成更"好看"的B；✗从预设列表中选择。\n' +
'\n' +
'---\n' +
'\n' +
'## §14 快速参照表\n' +
'\n' +
'### 14.1 标签密度速查\n' +
'\n' +
'```\n' +
'┌──────┬────────────┬──────────────┬─────────────┐\n' +
'│ 人数 │ Scene标签  │ 每人Char标签 │ 每人UC标签  │\n' +
'├──────┼────────────┼──────────────┼─────────────┤\n' +
'│ N=1  │ ≥18        │ ≥40          │ ≥12         │\n' +
'│ N=2  │ ≥15        │ ≥28          │ ≥10         │\n' +
'│ N=3  │ ≥12        │ ≥20          │ ≥8          │\n' +
'│ N≥4  │ ≥10        │ ≥14          │ ≥6          │\n' +
'└──────┴────────────┴──────────────┴─────────────┘\n' +
'```\n' +
'\n' +
'### 14.2 分级速查\n' +
'\n' +
'```\n' +
'┌────────────┬──────┬─────────────────────────┬──────────────────────┐\n' +
'│ 场景内容   │ 分级 │ 前缀                    │ 服装要求             │\n' +
'├────────────┼──────┼─────────────────────────┼──────────────────────┤\n' +
'│ 日常/战斗  │ Safe │ 无                      │ {fully clothed}      │\n' +
'│ 穿衣场景   │      │                         │ +{颜色}+{款式}       │\n' +
'├────────────┼──────┼─────────────────────────┼──────────────────────┤\n' +
'│ 暴露/内衣  │ R    │ {{nsfw}},               │ revealing            │\n' +
'│ 泳装场景   │      │                         │ 无器官露出           │\n' +
'├────────────┼──────┼─────────────────────────┼──────────────────────┤\n' +
'│ 裸体/器官  │ X    │ {{nsfw}}, {{uncensored}},│ {naked}+器官标签     │\n' +
'│ 性行为     │      │                         │                      │\n' +
'└────────────┴──────┴─────────────────────────┴──────────────────────┘\n' +
'```\n' +
'\n' +
'### 14.3 权重语法速查\n' +
'\n' +
'```\n' +
'强调: {tag}=1.05x, {{tag}}=1.10x, {{{tag}}}=1.16x, {{{{tag}}}}=1.22x\n' +
'精确: (tag:1.5)=1.5x, 1.5::tag::=1.5x（等效）\n' +
'弱化: [tag]=0.95x, [[tag]]=0.90x, [[[tag]]]=0.86x\n' +
'负权重（排斥）: -1.0::tag::=轻度, -1.5::tag::=中度, -2.0::tag::=强力\n' +
'UC高权重: 3.0::tag::=强力排斥, 5.0::tag::=超强排斥\n' +
'```\n' +
'\n' +
'### 14.4 主体类型速查\n' +
'\n' +
'```\n' +
'┌────────────┬─────────────────┬─────────────────────┐\n' +
'│ 主体类型   │ 主体标签权重    │ 角色名权重          │\n' +
'├────────────┼─────────────────┼─────────────────────┤\n' +
'│ 角色本身   │ 美/帅(1.8-2.0)  │ (Name:1.8-2.0)      │\n' +
'│ 动作瞬间   │ 动作(1.8-2.0)   │ (Name:1.0-1.3)      │\n' +
'│ 情感表达   │ 表情(1.8-2.0)   │ (Name:1.3-1.5)      │\n' +
'│ 魔法能力   │ 特效(1.8-2.0)   │ (Name:1.0-1.3)      │\n' +
'│ 服装穿着   │ 服装(1.5-1.8)   │ (Name:1.3-1.5)      │\n' +
'│ 双人互动   │ 互动(1.5-1.8)   │ (Name:1.3-1.5)双方  │\n' +
'│ 环境氛围   │ 环境(1.5-1.8)   │ (Name:1.0-1.3)      │\n' +
'└────────────┴─────────────────┴─────────────────────┘\n' +
'```\n' +
'\n' +
'### 14.5 方向词速查\n' +
'\n' +
'正面:`{facing viewer}, front view, {looking at viewer}`；背面:`{{from behind}}, {facing away}, {back view}`；左侧:`{facing left}, [profile left]`；右侧:`{facing right}, [profile right]`；斜角:`{three-quarter view}, [turned slightly]`；回头:`{looking back}, [head turned]`。\n' +
'\n' +
'### 14.6 姿态词速查\n' +
'\n' +
'站:`{standing}, upright`；坐:`{sitting}, {seated}`；躺:`{lying down}, {lying on back}, {lying on side}`；跪:`{kneeling}, {on knees}`；蹲:`{crouching}, {squatting}`；趴:`{on all fours}, {hands and knees}`；靠:`{leaning}, {bending over}`。\n' +
'\n' +
'### 14.7 禁止姿态组合速查\n' +
'\n' +
'✗facing viewer + legs from behind→前后矛盾；✗sitting torso + standing legs→坐站矛盾；✗lying down + walking→躺动矛盾；✗kneeling + feet flat on ground→跪站矛盾；✗on all fours + arms at sides→趴姿手臂矛盾。\n' +
'\n' +
'---\n' +
'\n' +
'## §SYS 系统覆盖指令\n' +
'\n' +
'### 执行优先级\n' +
'\n' +
'[P-1]剧情节奏→事件内流动，弹性终结；[P0]主体判断→动态分配所有权重⭐核心；[P1]文图对应→正文焦点=图片主体；[P2]DNA一致→角色外貌锁定；[P3]分级判断→Safe/R/X；[P4]人数检测→N=1/2/3/4+；[P5-8]视觉化→视角→身体→表情环境（从正文提取）；[P9]权重检查→主体最高+负权重+语法混用；[P10]多人互斥→空间坐标+UC屏蔽；[P11]标签数量→Scene/Char/UC达标。\n' +
'\n' +
'### 主体执行令\n' +
'\n' +
'1.这张图关于什么？→主体；2.主体→1.5-2.0或`{{{{}}}}`；3.相反/干扰→`-1.5::opposite::`；4.支撑→1.2-1.5或`{{}}`；5.角色→焦点(1.8-2.0)/载体(1.0-1.3)；6.其他→`{}`→无符号→`[]`→`[[]]`；7.没有固定权重规则，一切看主体。\n' +
'\n' +
'### 从正文提取执行令\n' +
'\n' +
'表情:正文写什么表情→翻译成标签（不默认smile）；动作:正文写什么动作→翻译成标签（不套模板）；姿势:正文写什么姿势→翻译成标签（不随便选）；情绪:正文传达什么情绪→翻译成标签（不自己加戏）；环境:正文描述什么环境→翻译成标签。\n' +
'\n' +
'### 语法检测\n' +
'\n' +
'□有精确权重(tag:x)或x::tag::？□有负权重排斥-x::tag::？□有{{}}强调？□有[]弱化？□主体权重最高？□不是全部单{}？\n' +
'\n' +
'### 图片数量要求\n' +
'\n' +
'图块数=输入段落数（由插件按段落切分决定，段落与图块一一对应），每个输入段落必须且只能输出1个图块，图片跟随剧情自然产生，不主导剧情。\n' +
'\n' +
'### imgthink完整性要求\n' +
'\n' +
'每张图的imgthink必须完成全部17个STEP（完整定义见§11.2，含每步字数下限），禁止跳过任何一个！imgthink总字数≥400中文字。\n' +
'\n' +
'### 最终检查清单\n' +
'\n' +
'输出前自检:图块数=输入段落数（一一对应，禁止合并/遗漏/堆叠）✓；imgthink完成全部17个STEP（见§11.2）✓；[STEP17]核心检查逐项全部✓。全部✓→发送 | 任一✗→按对应STEP修正后发送。\n' +
'\n';

                                                                                                                        var BUILTIN_PROMPT_FLOWER = '<L·Bridge生图规则·油猴世界书二改>\n' +
                    '【特征一致性｜角色tag必须逐字引用基线】（最高优先级之一）' +
                    '图片tag中的角色描述，必须以"角色特征基线"为准，逐字保留，禁止省略、禁止改写、禁止同义词替换。' +
                    '【智绘姬角色形象预设调用规则（最高优先级，本请求已注入智绘姬预设时强制生效）】' +
                    '1. 若上下文已注入「智绘姬启用角色」形象预设：' +
                    '   - 预设中列出的角色，其形象tag必须逐字采用预设内容（角色名用预设的英文名，外貌/五官/发型/身体特征/角色tag逐字复制），禁止省略、禁止改写、禁止同义词替换、禁止自行发明' +
                    '   - 角色类型四选一判定：存在于智绘姬特定角色列表 / 使用通用角色模板 / 原创角色 / 同人角色非预设；有明确原作的角色即使不在预设列表也必须写"英文名 (作品名)"' +
                    '   - 预设内角色调用格式：tag 里用英文名并逐字沿用预设的五官外貌与身体部位特征，方向词按画面需要取 from front/above/below/side/behind（可带 sfw/nsfw 档位）' +
                    '2. 预设与正文描述冲突时：预设优先级最高，正文仅作服装/动作/表情/场景补充' +
                    '3. 正文没有明确写出的角色外貌，一律以预设为准，禁止自行发明替代描述' +
                    '' +
                    '【特征基线规则】' +
                    '1. 每条消息生成图片tag前，先为每个出场角色建立特征基线：' +
                    '   - 基线 = 角色设定中的固定外貌特征 + 前文正文/图片tag已出现过的全部特征' +
                    '   - 新特征一旦在前文出现（正文或tag），自动进入基线，后续所有消息必须保留' +
                    '2. 每个<!--配图-->的tag里，角色描述部分必须逐字复制基线的全部特征条目，' +
                    '   一条都不能省略；只允许在其后追加该画面特有的动作/表情/视角/服饰变化。' +
                    '3. 同一条消息内：所有段落的tag，同一角色的特征描述必须完全一致（逐字相同），' +
                    '   只允许动作/表情/视角/镜头变化。' +
                    '4. 禁止行为：' +
                    '   - 禁止省略特征（如漏写痣、漏写虎牙、漏写翅膀）' +
                    '   - 禁止改写特征（如"黑发"改成"深棕发"、"左嘴角下小痣"改成"右嘴角痣"）' +
                    '   - 禁止同义词漂移（bat wings与demon wings、tiger tooth与canine tooth、ribbon与ribbons混用）' +
                    '   - 禁止凭空新增与基线冲突的特征；剧情性新增（换装/受伤/变身）必须在该消息内保持一致并延续' +
                    '5. 服饰按剧情可换，但同一消息内保持一致；换装必须有正文剧情依据。' +
                    '' +
                    '【判定标准】' +
                    '任意两张图角色tag逐项对比：基线特征条目必须完全一致，不一致即漂移，需修正。' +
                    '' +
                    '' +

                    '\n' +
                    '【本规则由「L·Bridge」自动读取并注入图API请求。输入：文游正文段落（每段【P{序号}】开头，段间空行分隔），一次可能多段。输出：**每段对应一个 <image>…</image> 图块，段落与图块严格一一对应，禁止合并/遗漏/文末堆叠**。生成前每个画面单元独立执行下方「视觉导演工作流」+「单图决策清单」（可在脑中完成，插件只提取 <image> 块）。】\n' +
                    '\n' +
                    '【绘图顶层纲领｜最高优先级规则，所有图像生成必须遵守】\n' +
                    '1. 角色命名规范：内部理解可使用中文名；输出绘图Prompt强制使用英文名称，同人角色格式：英文名 (作品名)。\n' +
                    '2. 图片排布规则：插件按画面单元切分正文，每个画面单元生成一张配图，配图紧跟对应单元后方；一张画面对应单一叙事瞬间，禁止连续复合动作。\n' +
                    '3. 基础绘制禁令：杜绝多指、肢体错位、人体比例崩坏；修正透视错误、空间遮挡逻辑、人物相对朝向/视线关系矛盾；严格匹配文本昼夜、室内外等时空环境；严格遵守文本指定角色数量，不得随意增删人物。\n' +
                    '4. Vibe功能执行约束：Vibe仅迁移画风、上色、线条质感；不得复制参考图构图、镜头、裁切、特写比例。叙事规定的景别（远景/中景/近景）、角色站位、画面主体优先级高于画风参考。当画风参考与画面结构冲突，以文字描述为准。禁止无理由生成脸部大特写。\n' +
                    '5. 创作定位：你是服务叙事的视觉导演，每张图先确认【叙事功能、视觉核心、时空切片、视点】，再构建画面，不能单纯直译文字。\n' +
                    '\n' +
                    '【画面主体规则｜最高优先级（画面主体不限于人物）】\n' +
                    '1. 画面主体不限于人物：答案可以是人物、环境、空间、物件、光影、氛围、抽象意象，只要它最有效地传递了这一画面单元的叙事信息和情绪。\n' +
                    '2. 留白段（环境描写、停顿、沉默、过渡）→ 环境镜头/长镜头/空镜；信息密集段（对话、揭示、转折、动作）→ 人物镜头/特写。\n' +
                    '3. 视点可选：角色主观视角/过肩视角/旁观者视角/全知视角/物件视角/无人视角（纯环境/物件，没有角色或角色极小，强调空间本身的情绪）。\n' +
                    '4. 景别跟随段落内容：全景/远景（环境为主，人物可小可无）→ 中景（动作/对话）→ 中近景 → 近景/特写（表情/手/物件细节）。段落是环境描写就出 wide shot，是"歪头"就出特写。\n' +
                    '5. 正文没有人物动作/没有明确人物在场的段落，禁止凭空添加人物；正文写"空无一人"的画面必须无人；正文无人时 Scene Composition 不写人物数量tag。\n' +
                    '6. 禁止无叙事理由的极端特写、大头贴、脸部占满画面。除非视觉核心明确是角色表情/眼神/微表情（并在决策中写明），否则必须保留完整人物空间关系。\n' +
                    '7. 同一次请求内的多个画面单元：镜头类型/景别/视角/视觉核心应互不相同或至少2种以上差异（人物近景/环境远景/物件特写/空镜交替），避免连续同质（全是中景人物、全是"角色A的脸"）。\n' +
                    '8. 锚点-画面-背景一一对应：正文侧每个 <!--配图--> 锚点 = 一个画面单元 = 一张图。VN 插件按【换行 + 图片占位】把正文切成一个个画面（点一下换一屏），**画面 ≠ 自然段**：同一自然段允许连续埋多个锚点（每句一锚点），每个锚点会被切成一个独立画面、各配一张图，画面与图严格一一对应；锚点必须写在完整句子的句末（句号/感叹号/问号/结束引号之后），禁止插在句子中间；两个锚点之间必须至少间隔一句完整文本（禁止连续锚点——中间没有文本的锚点单元会被丢弃）。单元内禁止自行拆出第二张图、禁止把多段合并进一个图块。\n' +
                    '\n' +
                    '【视觉导演工作流｜强制思考流程】\n' +
                    '本工作流是生成图片的强制思考流程，分为三个阶段：全文分析阶段、节奏规划阶段、单图决策阶段。必须按顺序执行，不可跳过。\n' +
                    '\n' +
                    '=== 第一阶段：全文叙事分析 ===\n' +
                    '在选择任何图片瞬间之前，先对本次注入的正文全文做以下分析：\n' +
                    '1.【叙事弧线】本次正文的整体情节结构是什么？（线性推进/情绪递进/平行交织/环形结构/碎片拼贴/其他）用一句话概括。\n' +
                    '2.【情绪曲线】哪些段落是情绪高点？（激烈、温暖、恐惧、悲伤、兴奋等）哪些是情绪低点？（平静、压抑、空虚、日常）情绪如何过渡？画面应覆盖情绪曲线的不同位置，而不是全部集中在高点。\n' +
                    '3.【信息密度】哪些段落是信息密集的（对话、揭示、转折），哪些是留白的（环境描写、停顿、沉默）？信息密集段适合用人物镜头/特写，留白段适合用环境镜头/长镜头。\n' +
                    '4.【角色关系变化】正文中角色关系是否发生变化？（从疏远到亲密、从信任到背叛、从平静到紧张等）关系变化的关键点是优先选图对象。\n' +
                    '5.【时空分布】正文涉及几个场景？几个时间点？是否有回忆/想象/闪回？不同时空用不同视觉风格或色调区分。\n' +
                    '\n' +
                    '=== 第二阶段：每片画面节奏规划 ===\n' +
                    '基于全文分析，为本次请求的每个画面单元分配叙事功能和视觉特征，构成一个有节奏的序列（不是独立插图）：\n' +
                    '【节奏模式】（选择一种，或自创）：\n' +
                    '- 经典模式：图1建立（场景/人物/氛围）→ 图2发展（情节推进/张力积累）→ 图3高潮（最有冲击力的瞬间）→ 图4收束（情绪沉淀/余韵/暗示）\n' +
                    '- 情绪模式：图1日常基调 → 图2情绪萌芽 → 图3情绪爆发 → 图4情绪余波\n' +
                    '- 对比模式：图1与图4形成呼应/对比，图2与图3形成递进/反转\n' +
                    '- 多线模式：画面分别聚焦不同角色/线索，拼合出完整叙事\n' +
                    '- 环境模式：图1大远景建立空间 → 图2中景引入人物 → 图3近景聚焦细节 → 图4回到远景/空镜收束\n' +
                    '- 主观模式：画面依次从不同角色的主观视角出发，展示同一事件的不同面\n' +
                    '- 其他模式：根据叙事性质自行设计\n' +
                    '【画面差异化检查】（规划完成后必须检查）：\n' +
                    '- 镜头类型：是否覆盖了不同镜头类型？（人物近景/环境远景/物件特写/心理抽象/混合等，至少2种以上）\n' +
                    '- 景别：是否有景别变化？（避免都是上半身特写）\n' +
                    '- 视角：是否有视角变化？（避免都是平视正面）\n' +
                    '- 风格：是否需要在某些画面中使用非默认风格？（回忆用褪色、想象用抽象、恐惧用扭曲等）\n' +
                    '- 视觉核心：是否各不相同？（避免都是"角色A的脸"）\n' +
                    '如果画面同质化严重，必须重新规划。\n' +
                    '\n' +
                    '=== 第三阶段：单图决策流程 ===\n' +
                    '为每个画面单元独立执行以下决策，结果完整映射进最终tag：\n' +
                    'Step 1【叙事功能定位】这个画面在序列中承担什么功能？要向观众传递什么核心信息或情绪？一句话概括。\n' +
                    'Step 2【视觉核心选择】什么是这个画面的视觉核心？思考路径：\n' +
                    '- 这段叙事的核心信息是什么？（一个动作？一种情绪？一个关系变化？一个物件？一个空间？）\n' +
                    '- 用什么视觉元素最能直接传递这个核心信息？\n' +
                    '  - 核心是"角色A的痛苦"→ 视觉核心可能是A的脸（表情）、A的手（紧握/颤抖）、A周围的空间（压抑的环境）\n' +
                    '  - 核心是"两人关系的破裂"→ 视觉核心可能是两人之间的距离/空隙、一个被摔碎的物件、背对背的构图\n' +
                    '  - 核心是"环境的压迫感"→ 视觉核心是空间本身（逼仄的构图、冷色调、阴影）\n' +
                    '- 视觉核心不唯一，但必须明确。明确后，所有构图、光影、细节都应服务于突出核心。\n' +
                    'Step 3【时空切片选择】当前时刻/前一刻/后一刻/回忆/想象/预示/时间叠合。选择哪个时间点最有叙事张力？"前一刻"有时比"正在发生"更有张力（如手即将触碰但还没碰到），"后一刻"有时比"正在发生"更有余韵（如事情发生后的沉默）。\n' +
                    'Step 4【视点选择】这个画面是谁在看？角色主观视角/过肩视角/旁观者视角/全知视角/物件视角/无人视角（纯环境/物件，没有角色或角色极小，强调空间本身的情绪）。谁的视点最能传递本图的叙事功能？例如"角色A发现了一个秘密"——用A的主观视角比用全知视角更有冲击力。\n' +
                    'Step 5【视角与景别选择】从哪看？看多近？\n' +
                    '- 距离：极远景（人很小，强调环境）/远景（全身+环境）/全景（全身）/中景（膝盖以上）/中近景（胸部以上）/近景（肩部以上）/特写（面部局部/手部/物件）/极特写（眼睛/嘴唇/细节）\n' +
                    '- 高度：平视（平等/亲密）/仰视（敬畏/压迫/高大）/俯视（渺小/脆弱/被监视）/鸟瞰（全局/疏离）/虫视（极端压迫/眩晕）\n' +
                    '- 角度：正面/侧面/3/4侧面/背面/斜角/荷兰角（倾斜，不安/失控）\n' +
                    '选择依据：景别和角度本身就是叙事语言。同样是"两个人对话"，平视中景=平等交流，俯视远景=两人在巨大空间中很渺小=孤独，仰视特写=其中一方在压迫另一方。\n' +
                    'Step 6【视觉修辞决策】从「视觉修辞与叙事焦点」中选择适合本画面的修辞手法，可叠加（不宜超过3种）。选择依据：哪种手法能最大化传递核心信息？例如核心是"角色内心的分裂"→分裂构图/镜像对比；"无法言说的悲伤"→留白/背影/空镜；"欲望的诱惑"→框架构图/局部特写/明暗对比。\n' +
                    'Step 7【风格媒介选择】从「风格媒介库」中选择。默认写实/动漫风格，但以下情况主动选择非默认风格：回忆/怀旧→褪色/暖黄/柔焦/胶片颗粒；想象/幻想→非写实/水彩/油画/抽象；恐惧/噩梦→高对比/扭曲/暗调/粗线条；幸福/温暖→柔光/暖调/过曝/花瓣/光斑；日常/宁静→自然光/低饱和/留白；激烈/爆发→高饱和/动态模糊/速度线/荷兰角。风格选择必须与叙事情绪一致，不同时空可用不同风格区分。\n' +
                    'Step 8【人数与构图裁定】本画面需要几人？（可为0，依据叙事功能决定，不设硬上限）每人的角色：核心/陪体/背景。构图根据视觉核心和视点决定人物位置（centers）、朝向、距离。非核心人物可简化、虚化、出框、或转为剪影。\n' +
                    'Step 9【元素填充】按「视觉元素谱系」遍历所有可见元素，填充属性。每个可见元素至少2个属性维度，核心元素（视觉核心相关）至少4个维度。\n' +
                    'Step 10【一致性校验】执行「视觉一致性工程」的8维度校验。发现问题立即修正。\n' +
                    '完成以上10步后，方可进入 image### 的tag组装。\n' +
                    '\n' +
                    '【视觉一致性工程｜强制校验体系】\n' +
                    '核心原则：在写tag之前，先在脑中建立一个物理自洽的三维空间和光影系统，然后将元素放入这个系统中，最后校验所有元素与系统的一致性。\n' +
                    '\n' +
                    '=== 维度1：人体结构一致性 ===\n' +
                    '【建模要求】每个可见角色必须在脑中建立完整的人体骨架，再往骨架上附着肌肉和皮肤。不是先画脸再补身体，而是先有整体结构。\n' +
                    '【校验项】1.比例：头身比是否符合角色设定？（成人约7-8头身，Q版2-4头身）肩宽、臂长、腿长、躯干比例是否协调？2.对称：左右两侧是否对称？（允许姿势性不对称，但结构性对称不能破坏）3.关节：每个关节的弯曲方向是否正确？（肘、膝、指、腕、肩、髋、踝）关节数量是否正确？4.手部：手指数量（5根）、指节数量（每根3节，拇指2节）、拇指位置（与其他四指相对）是否正确？5.面部：五官位置是否符合三庭五眼？双眼是否在同一水平线上？6.连接：头与颈、颈与肩、臂与肩、腿与髋的连接是否自然？有没有"漂浮的头"或"错位的肢体"？\n' +
                    '【tag解决方案】手部可见必须写手pose tag；复杂姿势必须写关节状态tag（bent elbow, extended arm, crossed knee等）；UC必加：bad anatomy, bad proportions, extra fingers, missing fingers, fused fingers, mutated hands, extra limbs, missing limbs, deformed, disfigured, mutation, poorly drawn face, asymmetric eyes\n' +
                    '\n' +
                    '=== 维度2：空间透视一致性 ===\n' +
                    '【建模要求】确定地平线位置、灭点位置（一点/两点/三点透视）、各元素在空间中的XYZ坐标。\n' +
                    '【校验项】1.近大远小：同一物体近处比远处大。2.灭线一致：所有平行线汇聚到同一灭点。3.地平线一致：同一平面上所有人物的眼睛大约在同一水平线。4.遮挡逻辑：A在B前方→A遮挡B→B被遮挡的部位省略tag或写out of frame/hidden。5.地面接触：所有站立/坐/卧的角色与地面/支撑面有明确接触点，不能埋进地面或漂浮。6.空间比例：人物与家具/建筑/环境的比例合理（不能人比门高或杯子比头大，除非特写）。\n' +
                    '【tag解决方案】Scene Composition写depth of field+前景/中景/背景元素；有明显透视写foreshortening/perspective/vanishing point；UC追加：bad perspective, unrealistic proportions, floating, object floating\n' +
                    '\n' +
                    '=== 维度3：物理交互一致性 ===\n' +
                    '【建模要求】所有物体（包括人体）受重力影响，所有接触必须有物理合理性。\n' +
                    '【校验项】1.重力：头发、衣服、饰品、液体、灰尘的下垂方向一致，无反重力漂浮。2.支撑：每个物体/角色的支撑点明确（站立→脚踩地面；坐→臀部接触椅面；卧→身体接触面；被抱→有支撑力的接触点）。3.接触面合理：手搭肩→手的形状贴合肩部曲线；坐椅→臀部与椅面贴合。4.穿透：禁止物体穿过物体（手穿桌、身体穿墙、杯子嵌入桌面）。5.作用力与反作用力：A推B→B有被推的倾斜/位移；A抱B→B有被托起的姿态，A有承重的肌肉紧张。6.服装物理：衣服贴合身体曲线，宽松处自然褶皱，紧身处处布料拉伸，飘动方向与风向/动作方向一致。\n' +
                    '【tag解决方案】每个角色写支撑/接触面tag（standing on floor, sitting on chair, lying on bed等）；有接触写接触部位tag（hand on shoulder, body press等）；动态场景写wind/floating hair/clothes lift等并确保方向一致；UC追加：physics error, object penetration, floating clothes, anti-gravity\n' +
                    '\n' +
                    '=== 维度4：光影一致性 ===\n' +
                    '【建模要求】建立完整光照系统：主光源位置→辅光源→反射光→各物体的受光面/背光面→阴影投射。\n' +
                    '【校验项】1.光源方向：所有物体的受光面朝向同一主光源方向。2.阴影方向：所有投影方向一致（与光源方向相反），软硬与光源性质匹配（小光源/远光源→硬阴影，大光源/近光源→软阴影）。3.色温统一：夕阳=暖橙，月光=冷蓝，日光灯=中性白，不能一半暖一半冷（除非明确第二光源）。4.反射光：暗部有合理环境反射光。5.特殊光效（丁达尔/光斑/霓虹/烛光）有对应光源来源。6.自发光（屏幕/灯/火焰）对周围产生光照影响。7.时间匹配：白天→太阳光，夜晚→月光/人工光（更暗更冷更局部），夜晚禁止无光源。\n' +
                    '【tag解决方案】Scene Composition写光源类型+方向+阴影/氛围（window light, side lighting, soft shadow, warm glow）；角色Prompt写受光状态（backlit, rim light, face in shadow, half-lit face）；夜晚必须写具体光源（moonlight/lamp/candle/neon），禁止只写night而无光源；UC追加：inconsistent lighting, bad shadow, light source error\n' +
                    '\n' +
                    '=== 维度5：语义对齐一致性 ===\n' +
                    '【建模要求】画面内容必须与正文描述严格对应——正文说了什么画面就必须画什么；正文没说的不能凭空添加；正文的核心必须是画面的核心。\n' +
                    '【校验项】1.主体对齐：正文着重描述的对象（人/物/环境/动作）是画面视觉核心？2.动作对齐：动作的主体、对象、方向、力度一致。3.情绪对齐：正文情绪与画面表情/色调/光影一致（正文写"悲伤"不能画"微笑"）。4.数量对齐：正文提到的人数/物数与画面一致（"三人对峙"不能只画两人，"空无一人"不能画人）。5.关系对齐：谁在对谁做什么、谁在看谁准确呈现。6.不添加：正文没提到的元素不能凭空添加（合理环境填充如家具可以，凭空多一个人不行）。7.不遗漏：正文明确描述的重要视觉元素不能遗漏。\n' +
                    '【tag解决方案】视觉核心与正文重点一致；动作tag来自正文描述，不能自创；表情tag与正文情绪一致；如果正文无人，Scene Composition中不写人物数量tag\n' +
                    '\n' +
                    '=== 维度6：时空一致性 ===\n' +
                    '【校验项】1.时间：正文时间（早晨/中午/黄昏/夜晚）与画面光线、天空状态一致。2.地点：正文地点与画面建筑、陈设、地貌一致。3.天气：晴/雨/雪/雾与画面一致（雨天有湿地面/雨滴/雾气）。4.季节：与植被、服装厚度、自然元素一致。5.时代：与建筑风格、服装、物件一致（古代场景不能出现手机）。6.室内外：室内必须有天花板/墙壁/室内陈设；室外必须有天空/地面/室外元素。\n' +
                    '【tag解决方案】Scene Composition写时间tag+地点tag+（如有）天气tag；时间与光影匹配；地点具体到空间类型（不能只写indoors，要写bedroom/cafe/forest）\n' +
                    '\n' +
                    '=== 维度7：角色连续性一致性 ===\n' +
                    '【校验项】1.同一角色在多个画面中（以及与本片之前已生成画面的对比中）的核心外貌特征一致（发色/发型/瞳色/肤色/体型/标志性特征）。2.服装与剧情时间线一致（上一段换了衣服，下一段不能还穿旧衣服，除非剧情明确）。3.身体状态连续（上一段受伤，下一段还有伤；上一段淋湿，下一段还是湿的）。4.调用角色预设时使用相同预设名称和参数。\n' +
                    '【tag解决方案】同一角色始终使用相同英文名和预设调用；身体状态变化必须在剧情中有依据；跨画面时间跨度大时服装/状态变化必须合理\n' +
                    '\n' +
                    '=== 维度8：因果逻辑一致性 ===\n' +
                    '【校验项】1.画面状态有前因（脸上有伤→之前有打斗；衣服湿了→有雨/水/汗来源）。2.动作有合理后果（正在跑→头发/衣服有动态；正在哭→有眼泪/红肿眼睛）。3.物件状态合理（使用中被握持/操作，闲置放合理位置，损坏有痕迹）。4.环境状态与角色行为一致（打斗后的房间凌乱，温馨场景整洁温暖）。\n' +
                    '【tag解决方案】追加状态tag必须确保有剧情来源（不能凭空写bleeding如果正文没写受伤）\n' +
                    '=== 校验执行规则 ===\n' +
                    '1.每个画面单元生成前必须逐项回答8个维度的校验结果（可在脑中完成）。2.任何一项不通过，必须先修正再输出tag。3.修正优先级：人体结构>空间透视>物理交互>光影>语义对齐>时空>角色连续>因果逻辑。4.多维度冲突时优先保证物理空间自洽，再调整叙事元素。\n' +
                    '\n' +
                    '【视觉修辞与叙事焦点】\n' +
                    '本谱系是视觉表达手法的完整库。AI在单图决策Step 6中必须从中选择适合的修辞手法。手法不是"风格滤镜"，而是叙事工具——每一种手法都在传递特定的叙事信息和观众引导。\n' +
                    '\n' +
                    '=== 一、构图修辞 ===\n' +
                    '1.【框架构图】用门框、窗框、镜子、走廊、树枝等自然框架包围主体。叙事功能：暗示限制、窥视、被注视、视角局限性、角色被困在某种处境。tag：framed by window, door frame, mirror frame, through the window, corridor\n' +
                    '2.【引导线构图】用道路、栏杆、楼梯、视线、肢体方向等线条引导目光到视觉核心。叙事功能：控制注意力、强调核心、制造纵深。tag：leading lines, vanishing point, road, railing, staircase, gaze direction\n' +
                    '3.【留白构图】大面积空白/暗部/天空/墙面，主体只占画面一小部分。叙事功能：孤独、空虚、渺小、压抑、宁静、未知、情绪的留白空间。tag：negative space, empty space, wide shot, distant figure, vast landscape, dark background\n' +
                    '4.【分裂构图】画面被明显分割（光影/色彩/物体/左右镜像）。叙事功能：内心矛盾、关系对立、两个世界、现实与幻想的分界、选择的两难。tag：split screen, dual persona, light and dark, mirror image, divided composition\n' +
                    '5.【三角构图】三个元素形成三角形。叙事功能：稳定的三角关系、张力平衡、三人对峙、稳固或即将崩塌的结构。tag：triangle composition, three people, triangular arrangement\n' +
                    '6.【对称构图】左右或上下严格对称。叙事功能：秩序、仪式感、庄重、压抑的规整、镜像关系。tag：symmetrical, mirror image, centered composition, formal balance\n' +
                    '7.【倾斜构图（荷兰角）】画面地平线倾斜。叙事功能：不安、失控、眩晕、精神错乱、紧张感。tag：dutch angle, tilted horizon, slanted composition\n' +
                    '8.【叠层构图】前景物体遮挡部分画面，形成"透过某物看"的效果。叙事功能：窥视感、隐藏、不完整信息、角色被阻隔/保护。tag：foreground element, through the leaves, over the shoulder, blurred foreground\n' +
                    '\n' +
                    '=== 二、光影修辞 ===\n' +
                    '1.【伦勃朗光】单侧45度光，面部一侧有三角形亮区。叙事功能：戏剧性、人物深度、神秘、坚毅、古典感。tag：rembrandt lighting, side lighting, dramatic shadow, half-lit face\n' +
                    '2.【剪影】人物完全为黑色轮廓，背景亮。叙事功能：匿名感、普遍性、神秘感、情绪的外化。tag：silhouette, backlit, dark figure, bright background\n' +
                    '3.【顶光】光源从正上方打下。叙事功能：神圣感、被注视/审判、舞台感、眼窝深陷的恐怖感。tag：top lighting, overhead light, dramatic lighting, god rays\n' +
                    '4.【底光】光源从下方打上。叙事功能：恐怖、诡异、非人、颠覆正常认知。tag：bottom lighting, underlighting, campfire light, eerie\n' +
                    '5.【边缘光/轮廓光】逆光勾勒人物边缘。叙事功能：分离人物与背景、神圣感、梦幻、即将离开/消失。tag：rim light, backlighting, edge light, halo effect\n' +
                    '6.【光斑/散景】背景化为模糊彩色光斑。叙事功能：梦幻、浪漫、回忆、注意力集中。tag：bokeh, light particles, blurred background, shallow depth of field, fairy lights\n' +
                    '7.【体积光/丁达尔】光线在空气中形成可见光束。叙事功能：神圣、希望、穿透、空间的深度、时光感。tag：volumetric light, god rays, light beams, dust particles, sunlight through window\n' +
                    '8.【高对比/低光】大面积暗部少量亮区。叙事功能：神秘、危险、压抑、恐惧、秘密、黑色电影氛围。tag：high contrast, low key, dark, shadow, chiaroscuro, film noir\n' +
                    '9.【过曝/柔光】整体偏亮、柔和、低对比。叙事功能：幸福、梦幻、回忆、过于美好而不真实。tag：overexposed, soft light, dreamy, hazy, warm glow, ethereal\n' +
                    '\n' +
                    '=== 三、色彩修辞 ===\n' +
                    '1.【冷暖对比】冷色与暖色并置。叙事功能：情绪对立、两个世界差异、内心与外界的冲突。tag：warm and cold contrast, blue and orange, complementary colors\n' +
                    '2.【单色/限色】只用一种色调或极少颜色。叙事功能：情绪极致化、风格化、回忆、压抑/忧郁/愤怒的单色表达。tag：monochrome, sepia, limited palette, blue theme, red theme\n' +
                    '3.【高饱和】色彩鲜艳浓烈。叙事功能：激情、幻想、非现实、感官过载、生命力。tag：vibrant colors, high saturation, vivid, colorful\n' +
                    '4.【低饱和/褪色】色彩灰暗不饱和。叙事功能：回忆、旧时光、压抑、疲惫、现实的冰冷。tag：muted colors, faded, desaturated, pastel, washed out\n' +
                    '5.【情绪色】某种颜色笼罩画面传递情绪。红=激情/危险/愤怒；蓝=冷静/悲伤/孤独；绿=自然/病态/诡异；紫=神秘/高贵/欲望；黄=温暖/警告/疯狂；粉=甜蜜/暧昧；灰=中立/压抑/虚无。tag：color overlay, tinted, [color] theme, moody lighting\n' +
                    '\n' +
                    '=== 四、视角修辞 ===\n' +
                    '1.【主观视角（POV）】观众看到的就是角色看到的。叙事功能：极致代入、信息限制、感官体验。tag：pov, first person view, pov hands, looking through eyes\n' +
                    '2.【极端仰视】极低角度向上看。叙事功能：压迫感、高大/威胁/神圣、孩童视角。tag：from below, low angle, worm\'s eye view, looking up\n' +
                    '3.【极端俯视】极高角度向下看。叙事功能：渺小感、脆弱、被监视、全局掌控、棋盘感。tag：from above, high angle, bird\'s eye view, looking down, top view\n' +
                    '4.【过肩视角】从角色肩后看另一角色。叙事功能：建立"看与被看"关系、对话临场感。tag：over the shoulder, ots shot, from behind person\n' +
                    '5.【背面视角】只看到角色背影。叙事功能：未知、离去、拒绝、内向、面对广阔世界。tag：from behind, back view, facing away, back turned\n' +
                    '6.【物件视角】从物件角度看场景。叙事功能：疏离、客观、时间流逝、悬念。tag：（通过构图实现，如极低角度=桌面视角，镜框内=镜子视角）\n' +
                    '\n' +
                    '=== 五、时空修辞 ===\n' +
                    '1.【前一刻】画动作发生前的瞬间。叙事功能：悬念、张力、期待。tag：reaching out, about to, moment before, suspended action\n' +
                    '2.【后一刻】画动作发生后的瞬间。叙事功能：余味、后果、情绪沉淀。tag：aftermath, aftermath of, empty, lingering, silence\n' +
                    '3.【慢动作/残影】动作中留下运动轨迹或残影。叙事功能：关键时刻放大、情绪延长。tag：motion blur, afterimage, slow motion, speed lines, motion lines\n' +
                    '4.【回忆叠影】回忆画面叠加在当前画面上。叙事功能：记忆侵扰、过去与现在交织。tag：double exposure, memory overlay, flashback, ghost image\n' +
                    '5.【时间停滞】所有动态元素凝固。叙事功能：关键时刻的永恒感。tag：frozen moment, time stop, suspended, stillness\n' +
                    '\n' +
                    '=== 六、隐喻与象征修辞 ===\n' +
                    '1.【物件隐喻】用一个物件代表抽象概念：破碎的镜子=关系破裂/自我分裂；枯萎的花=失去希望/衰老；牢笼的影子=束缚/囚禁；燃烧的照片=毁灭记忆；空椅子=缺席/等待；关门=结束/拒绝；打开的窗=自由/可能；钟表=时间流逝/死亡逼近；伞=保护/隔阂；倒影=另一个自我/真相。使用方式：在Scene Composition或环境中加入隐喻物件，不需要角色直接互动。\n' +
                    '2.【环境隐喻】用环境状态代表角色内心：暴风雨=内心动荡；晴朗=心境开阔；废墟=创伤/崩塌；迷宫=困惑；悬崖=危险的边缘；花园=成长/美好；沙漠=孤独/枯竭；森林=未知/潜意识。环境描写与角色情绪形成同构关系。\n' +
                    '3.【动物隐喻】用动物代表角色特质或关系（仅在叙事合理时使用，如想象/梦境/象征场景）：狼=危险/野性；羊=脆弱/顺从；鸟=自由/逃离；蛇=诱惑/背叛；猫=独立/神秘；蝶=蜕变/短暂。tag：animal symbolism, [animal] motif\n' +
                    '4.【身体隐喻】用身体状态代表心理状态：紧握的手=压抑的愤怒/紧张；颤抖=恐惧/激动；低垂的头=羞愧/悲伤；张开的双臂=接纳/绝望；蜷缩=自我保护/恐惧；挺直的背=坚强/抗拒。通过姿势和动作细节传递。\n' +
                    '\n' +
                    '=== 七、信息控制修辞 ===\n' +
                    '1.【遮挡/隐藏】关键信息被遮挡（手遮脸、物体挡关键物件、阴影遮面部）。叙事功能：悬念、未知、隐藏面、信息不对称。tag：face in shadow, hidden face, covering face, object blocking, obscured\n' +
                    '2.【局部特写】只画整体的一小部分（一只手、一双眼、嘴唇、物件细节）。叙事功能：极致聚焦、感官强化、以小见大、情绪的浓缩、回避直接展示（只画紧握的手不画脸比画脸更有张力）。tag：extreme close-up, close-up, detail shot, hand focus, eye focus\n' +
                    '3.【画外空间】重要元素在画面外，只通过角色视线/反应暗示。叙事功能：想象空间、恐惧、角色的反应比对象本身更重要。tag：looking off screen, out of frame, reaction shot, implied presence\n' +
                    '4.【全知展示】所有信息都在画面中。叙事功能：客观、上帝视角、命运感、戏剧性反讽。tag：wide shot, full view, establishing shot, bird\'s eye view\n' +
                    '\n' +
                    '=== 修辞使用规则 ===\n' +
                    '1.每个画面单元至少选择1种修辞手法。2.修辞必须服务于叙事功能，不能为了"好看"堆砌。3.可叠加多种（如"框架构图+伦勃朗光+冷暖对比"），不宜超过3种。4.同一次请求内的多个画面、以及相邻画面的修辞应有差异性，避免都用同一种手法。5.修辞选择必须与视觉导演工作流的叙事功能定位一致。\n' +
                    '\n' +
                    '【视觉元素谱系】\n' +
                    '生成每个画面时，必须按谱系遍历所有可见元素，为每个元素填充至少3个属性维度（核心元素至少4个）。属性之间有逻辑关联，填充时必须保证一致性（如"丝绸材质"应搭配"柔软垂坠"而非"硬挺褶皱"）。\n' +
                    '\n' +
                    '=== A. 人物元素谱系 ===\n' +
                    'A1.身份属性：年龄(child/loli/teenage/young/mature/milf/dilf/middle aged/old/elderly)；性别(1girl/1boy/1milf/1dilf/androgynous)；职业/身份(按剧情设定：student/teacher/maid/knight/office lady/doctor/bartender/nun等)；体态基调(petite/tall/short/skinny/slim/curvy/voluptuous/muscular/chubby/fat/plus size/athletic)\n' +
                    'A2.皮肤属性：肤色(pale/fair/tan/dark/olive/alabaster skin)；质感(smooth/shiny/oily/dry/sweaty/wet/glossy/matte skin)；痕迹(freckles/mole/beauty mark/scar/birthmark/stretch marks/cellulite/veins/bruise/scratch/tattoo/piercing/wrinkle)；状态(goosebumps/sunburn/blushing/pale/flushed/sweaty/wet/dirty/bruised/bleeding)\n' +
                    'A3.头部属性：脸型(round/oval/heart shaped/square/sharp/chubby/gaunt/baby face)；额头(high/broad/small forehead, bangs covering forehead)；眉毛(thick/thin/arched/straight/furrowed/raised/knitted/shaved eyebrows)；眼睛（形状：big/small/slanted/round/almond/hooded/sleepy/sharp/gentle/half-closed/wide/squinting；瞳色：blue/green/brown/red/purple/yellow/gray/heterochromia/sparkling/empty/dull/glowing eyes；睫毛：long/short/thick/false eyelashes；眼睑：double/single/hooded eyelid）；鼻子(small/pointed/button/aquiline/wide nose)；嘴唇(thick/thin/full/parted/glossy/dry/bitten lips, smiling lips, frowning, open mouth, tongue out, licking lips)；牙齿(perfect teeth/fang/braces)；耳朵(small/pointed/elf ears, ear piercing)；下颌(sharp/soft/square jaw, double chin, defined jawline)\n' +
                    'A4.毛发属性：长度(very short/short/medium/long/very long/waist length/knee length hair)；发型(straight/wavy/curly hair, twin tails, ponytail, bun, braid, french braid, messy hair, bob cut, pixie cut, hime cut, layered hair, ahoge, side swept bangs, blunt bangs, parted bangs)；发色(black/blonde/brown/red/blue/pink/white/silver/green/purple/orange hair, gradient/streaked/dyed/gray hair)；发质(shiny/silky/dry/frizzy/thick/thin/coarse/fine hair)；状态(wet/messy/floating/wind blown hair, hair over one eye, hair over shoulder, hair covering face, hair tied up, hair down)\n' +
                    'A5.躯干与四肢属性：颈部(long/short/thick/slender neck, adam\'s apple)；肩部(broad/narrow/sloped/bony/muscular shoulders)；胸部(flat chest, small/medium/large/huge breasts, perky/sagging breasts, sideboob, underboob, cleavage, collarbone)；背部(bare back, shoulder blades, back muscle)；腰部(narrow/thick/toned waist, waist indentation)；腹部(flat/toned/soft stomach, abs, belly button, pregnant)；臀部(round/firm/flat/big butt, wide/narrow hips)；手臂(long/short/muscular/slender/toned arms)；手(small/large/delicate/rough hands, long/short fingers, nail polish, ring, bracelet, gloves)；腿(long/short/muscular/slender/thick/thin legs, toned legs, calf muscle, knee)；脚(small/large feet, barefoot, anklet, socks, shoes)\n' +
                    'A6.姿势属性：整体姿态(standing/sitting/lying/kneeling/crouching/squatting/bending/leaning/walking/running/jumping/dancing/stretching/reaching/falling/floating)；脊柱(straight/arched/bent back, twisted torso, leaning forward/back/to side)；头部(head tilt/head down/head up/head turned, facing forward/side/away)；手臂位置(arms up/down/crossed/behind back/behind head, one/both arms raised, arms at sides/forward/wrapped around)；腿部姿势(crossed/spread legs, bent knees, one leg up, sitting cross-legged, seiza, M-shaped legs, legs together/apart)；脚部姿势(feet together/apart, tiptoe, heels up, feet dangling, crossed ankles)\n' +
                    'A7.表情属性：基础表情(smile/frown/angry/sad/happy/surprised/scared/confused/bored/tired/excited/shy/embarrassed/arrogant/gentle/serious/expressionless/smug/teasing/caring/loving/disgusted/contemptuous)；眉部微表情(furrowed brow/raised eyebrows/raised one eyebrow)；眼部微表情(half-lidded eyes/wide eyes/squinting/teary eyes/eyes watering/closed eyes/eyes darting/avoiding eye contact/staring/glaring/soft gaze/sharp gaze/empty gaze/bedroom eyes)；嘴部微表情(parted lips/biting lip/licking lips/tongue out/smirk/grin/pout/pursed lips/trembling lips/open mouth/gasping/sighing/whispering/shouting)；面部微表情(blush/nose blush/full-face blush/ear blush/sweatdrop/cold sweat/trembling/face fault/pale face/flushed face/angry vein)；复合表情示例：害羞的微笑(smile+nose blush+avoiding eye contact+fidgeting)；压抑的愤怒(furrowed brow+gritted teeth+clenched fist+trembling+forced calm)；含泪的微笑(smile+teary eyes+trembling lips+looking up)；慵懒的魅惑(half-lidded eyes+parted lips+smirk+messy hair+relaxed posture)；恐惧的僵硬(wide eyes+pale face+cold sweat+trembling+frozen posture)\n' +
                    'A8.动作属性：手部动作(open/clenched/relaxed hands, reaching out, grabbing, holding, pinching, touching, caressing, stroking, rubbing, pressing, pulling, pushing, lifting, dropping, interlocked fingers, hands on own chest/face/lap, hands behind head, hands on hips, covering face/mouth/eyes, rubbing eyes, scratching head, waving, pointing, saluting, finger to mouth, peace sign, thumbs up)；手臂动作(arm around shoulder/waist/neck, arms wrapped around, pulling someone close, pushing away, reaching for, catching, throwing)；头部动作(nodding, shaking head, tilting head, looking up/down/left/right, turning head, burying face, resting head)；腿部动作(kicking, stepping, stomping, crossing/uncrossing legs, bending knee, extending leg, wrapping legs around)；全身动作(hugging, kissing, dancing, spinning, jumping, falling, rolling, crawling, climbing, swimming, fighting, punching, kicking, slapping, grabbing, pushing, pulling, lifting, carrying, princess carry, piggyback, embracing from behind)\n' +
                    'A9.视线属性：方向(looking up/down/left/right/forward/back/away)；目标(looking at viewer, looking at another, eye contact, gazing at [对象], staring at, glancing at, peeking at, observing)；眼神特质(intense/soft/sharp/gentle/empty/dull/loving/hateful/fearful/confident/shy gaze, teasing gaze, bedroom eyes, thousand yard stare)\n' +
                    'A10.空间关系属性：与其他人物(distance: close/far/intimate/social, facing direction relative to each other, contact point, relative height)；与环境(position in space, support surface, occlusion relationship, interaction with furniture)；与画面(position(centers), size in frame, clarity(focus/blur), framing)\n' +
                    '\n' +
                    '=== B. 服装元素谱系 ===\n' +
                    'B1.类型与层次：外层(coat/jacket/cloak/cape/cardigan/blazer/overcoat/parka/trench coat/leather jacket/denim jacket/hooded coat)；中层(shirt/blouse/sweater/hoodie/vest/dress/tunic/polo shirt/tank top/camisole/t-shirt/sweatshirt)；内层/贴身(underwear/bra/panties/camisole/tank top/undershirt/lingerie/boxer briefs/thong)；下装(skirt/pants/jeans/shorts/leggings/tights/stockings/thighhighs/pantyhose/sweatpants/wide leg pants/pencil skirt/pleated skirt/mini skirt/maxi skirt)；鞋类(boots/heels/sneakers/sandals/loafers/slippers/barefoot/thigh boots/ankle boots/platform shoes/flats/mary janes)；泳装/特殊(bikini/one-piece swimsuit/school swimsuit/apron/kimono/yukata/cheongsam/hanfu/uniform/armor/spacesuit)\n' +
                    'B2.颜色属性：主色(black/white/red/blue/green/yellow/purple/pink/orange/brown/gray/beige/navy/maroon/teal/mint/lavender)；辅色/配色(black dress with white collar, red skirt with black stripes)；颜色特质(pastel/neon/muted/vibrant/dark/light/gradient/two-tone/color block)\n' +
                    'B3.材质属性：纤维/面料(cotton/linen/wool/silk/satin/velvet/lace/mesh/chiffon/denim/leather/vinyl/rubber/neoprene/knit/fleece/polyester/nylon)；织法/纹理(ribbed/knitted/woven/textured/smooth/fishnet/sheer/opaque/transparent/translucent)；厚度(thick/thin/lightweight/heavy/bulky)；光泽(matte/glossy/shiny/metallic/iridescent)；弹性(stretchy/tight/loose/form-fitting/oversized)；垂坠感(flowing/draping/stiff/structured/voluminous/weighty)\n' +
                    'B4.剪裁与结构属性：版型(fitted/loose/oversized/bodycon/a-line/flared/straight/tapered/baggy/skinny/wide-leg)；领型(crew neck/v-neck/turtleneck/square neck/off shoulder/halter/strapless/one shoulder/cowl neck/scoop neck/collared)；袖型(long/short sleeves, sleeveless, cap/puff/bell/batwing/kimono/ruffled sleeves)；裙型(pleated/flared/pencil/a-line/mini/midi/maxi/wrap skirt, high slit, layered skirt)；裤型(skinny/straight/wide leg/bootcut/cargo/jogger/high waist/low rise/cropped)；长度(cropped/full length/knee length/ankle length/thigh high)\n' +
                    'B5.装饰属性：纹样(plaid/striped/floral/polka dot/argyle/camouflage/embroidered/printed/patterned/plain/solid/geometric/animal print/paisley/houndstooth)；装饰细节(lace trim/ruffle/frill/bow/ribbon/button/zipper/buckle/belt/sash/drawstring/tassel/sequin/bead/pearl/stud/spike/patch/pin)；特殊结构(hood/collar/lapel/cuff/hem/slit/pocket/lining)\n' +
                    'B6.状态属性：新旧(new/worn/old/faded/vintage)；破损(torn/ripped/frayed/cut/broken zipper/missing button/hole)；污渍(stained/dirty/muddy/bloody/food stain/sweat stain)；湿润(wet/damp/soaked/dripping/sweaty/see-through wet)；褶皱(wrinkled/crumpled/pressed/ironed/messy)；穿法(buttoned/unbuttoned/zipped/unzipped/tied/untied/tucked in/untucked/rolled up sleeves/pushed up/collar popped/asymmetrical wear)；松紧(tight/loose/slipping/falling off/askew/adjusted)\n' +
                    'B7.动态属性：飘动(floating/fluttering/blowing in wind/flowing/trailing)；贴身(clinging/skin tight/body-hugging/wet and clinging)；滑落(slipping off/falling down/sliding down/off shoulder)；摆动(swinging/swaying/bouncing/flaring)；缠绕(wrapped around/tangled/twisted)\n' +
                    'B8.文化与功能属性：时代(modern/medieval/victorian/edwardian/80s/90s/futuristic/ancient/contemporary)；地域/民族(japanese/chinese/korean/western/arabian/nordic/tropical)；场合(casual/formal/business/party/sleepwear/swimwear/sportswear/uniform/costume/wedding/funeral)；身份标识(school uniform/military uniform/maid outfit/nurse uniform/chef uniform/priest robe/royal robe/lab coat)\n' +
                    'B9.与身体关系：暴露(revealing/modest/skimpy/covering/sheer/see-through/open/backless/strapless/side cutout)；遮蔽(covered/opaque/layered/high neck/long sleeves/floor length)；紧身度(tight/loose/form-fitting/oversized/baggy)；层次叠加(layered/stacked/coat over dress/shirt under sweater/jacket over shoulders)；与皮肤对比(black lace on pale skin, wet white shirt on tan skin)\n' +
                    '\n' +
                    '=== C. 环境元素谱系 ===\n' +
                    'C1.空间类型：室内(bedroom/living room/kitchen/bathroom/dining room/office/classroom/library/cafe/restaurant/bar/pub/nightclub/hotel room/hospital room/corridor/staircase/elevator/balcony/garage/basement/attic/warehouse/factory/gym/swimming pool/dressing room/hallway/entrance hall)；室外(street/alley/park/garden/forest/woods/beach/mountain/river/lake/cityscape/skyline/rooftop/bridge/train station/airport/parking lot/field/meadow/desert/snowscape/cliff/cave/waterfall/ruins/temple/shrine/castle/farm/village/highway/crosswalk)\n' +
                    'C2.建筑结构：墙面(brick/concrete/wooden/plaster/tiled/wallpaper/painted/stone/glass wall, graffiti/cracked/moldy wall)；地面(wooden/tiled/carpet/concrete/marble/dirt floor, grass/sand/snow/water/puddle/wet floor/blood stain)；天花板(high/low ceiling, exposed beams, chandelier, ceiling fan, skylight, vaulted ceiling)；门窗(window/large window/bay window/stained glass window/window seat, door/wooden/glass/sliding/iron door, door frame, window frame, curtains, blinds, shutters)；结构元素(staircase, spiral staircase, railing, pillar, column, arch, archway, corridor, hallway, balcony, terrace, loft, mezzanine, ladder)\n' +
                    'C3.陈设与物件：家具(bed/sofa/couch/chair/armchair/table/desk/dining table/coffee table/bookshelf/wardrobe/closet/cabinet/drawer/nightstand/dresser/mirror/full length mirror/vanity/stool/bench/ottoman/bean bag)；电器电子(lamp/ceiling light/chandelier/tv/computer/laptop/phone/tablet/radio/speaker/microwave/refrigerator/oven/washing machine/air conditioner/fan/heater/game console)；软装饰(curtain/carpet/rug/pillow/cushion/blanket/bedsheet/comforter/painting/poster/photo frame/clock/vase/plant/flower pot/candle/incense/figurine)；厨房用品(cup/mug/plate/bowl/chopsticks/fork/knife/spoon/pot/pan/kettle/bottle/wine glass/cocktail glass/tray/cutting board)；文具书籍(book/notebook/pen/pencil/newspaper/magazine/letter/envelope/document/file/folder)；室外物件(bench/lamppost/streetlight/traffic light/signboard/mailbox/fence/gate/fountain/statue/trash can/bicycle/motorcycle/car/bus/train)\n' +
                    'C4.材质与纹理：家具材质(wooden/metal/glass/plastic/leather/fabric/marble/granite/wicker/rattan)；纹理细节(wood grain/marble veining/brick pattern/tile pattern/fabric texture/metal scratch/rust/peeling paint/cracks/water stain)\n' +
                    'C5.光线属性（见光影元素谱系）\n' +
                    'C6.天气与自然：天空(clear/blue/cloudy/overcast sky, sunset/sunrise/night/starry sky, full moon/crescent moon/stormy sky, rainbow)；降水(rain/heavy rain/drizzle/snow/snowing/blizzard/hail/sleet)；大气现象(fog/mist/haze/smog/steam/smoke/dust/pollen/falling leaves/falling petals/cherry blossoms/wind)；温度感(cold=breath vapor+thick clothes, hot=sweat+sun glare)\n' +
                    'C7.时间属性：时刻(dawn/sunrise/morning/noon/afternoon/sunset/dusk/evening/night/midnight/late night)；季节(spring/summer/autumn/winter)；年代（通过建筑/服装/物件暗示）\n' +
                    'C8.声音的视觉化：可视觉化的声音元素(vibrating glass/rippling water/falling dust/shaking leaves/flickering flame/vibrating strings/sound waves/speech bubble/musical notes/motion lines)；使用场景：安静场景微小声音（钟摆声→摆动的钟摆），嘈杂场景（震动的杯子暗示音乐声）\n' +
                    'C9.氛围属性：温度感(warm/cold/hot/cool/cozy/chilly/sweltering/freezing)；湿度感(humid/dry/damp/moist/steamy)；气味感（通过视觉元素暗示：incense smoke=香薰味，food steam=食物香味，rain on dirt=泥土味）；情绪基调(oppressive/peaceful/tense/romantic/eerie/nostalgic/lively/desolate)\n' +
                    'C10.空间深度：前景(closest elements to camera：遮挡物/桌面/门框/植物)；中景(main action/subjects area)；背景(environment behind subjects)；远景(distant elements：sky/far buildings/horizon)；每层至少一个具体元素，禁止"背景=模糊色块"\n' +
                    '\n' +
                    '=== D. 物件元素谱系 ===\n' +
                    'D1.类型属性：大类(furniture/electronic/tool/weapon/food/drink/clothing accessory/stationery/musical instrument/sports equipment/toy/jewelry/cosmetic/medical/vehicle/plant/animal/magical item/artifact)；具体类型（根据剧情确定）\n' +
                    'D2.材质属性：主要材质(wood/metal/glass/plastic/ceramic/paper/fabric/leather/stone/crystal/bone/organic)；次要材质/部件(wooden handle with metal head, glass bottle with cork)；表面处理(polished/matte/rough/smooth/textured/engraved/carved/painted/coated/rusted/oxidized)\n' +
                    'D3.外观属性：颜色；形状(round/square/rectangular/triangular/cylindrical/spherical/irregular/organic/geometric)；大小（相对人物/环境的比例感：palm-sized/life-sized/miniature/giant）；重量感（通过握持方式暗示：heavy=muscle tension，light=fingers loosely holding）\n' +
                    'D4.状态属性：完整度(intact/broken/cracked/chipped/dented/torn/shredded/melted/burnt/shattered)；使用状态(in use/idle/abandoned/new/old/worn out/antique/vintage)；动态(moving/spinning/falling/rolling/floating/vibrating/burning/melting/dripping/overflowing)\n' +
                    'D5.功能属性：叙事功能(clue线索/prop道具/symbol象征/background element背景/weapon武器/gift礼物/evidence证据/macguffin核心驱动物件)；使用方式(held/worn/placed/displayed/hidden/broken/consumed/operated)\n' +
                    'D6.与人物关系：被持有(holding/carrying/wearing/gripping/clutching/loosely holding)；被使用(operating/playing/eating from/drinking from/writing with/cutting with)；被注视(looking at/staring at/examining/glancing at)；被遗弃(discarded/left behind/dropped/lying on floor/thrown away)\n' +
                    'D7.与环境关系：放置位置(on table/on shelf/on floor/on wall/hanging/in drawer/in pocket/on ground/in water)；与周围物件关系(next to/under/over/behind/in front of/stacked with/surrounded by)\n' +
                    '\n' +
                    '=== E. 光影元素谱系 ===\n' +
                    'E1.光源类型：自然光(sunlight/moonlight/starlight/skylight/ambient outdoor light)；人工光(lamp/ceiling light/chandelier/candle/candlelight/neon light/fluorescent light/incandescent light/led light/screen light/tv light/phone light/flashlight/spotlight/stage light)；特殊光(fire/campfire/fireplace/explosion/lightning/bioluminescence/magical light/glowing object)\n' +
                    'E2.光线方向：front/side/back/top/bottom lighting, rim/edge/under/overhead lighting, window light, door light\n' +
                    'E3.光线强度：bright/dim/dark/faint/strong/soft/harsh/gentle/intense/subdued/overexposed/underexposed\n' +
                    'E4.光线色温：warm/cool/neutral/golden/orange/blue/white/yellow/red/purple/green tint, mixed lighting\n' +
                    'E5.阴影：硬软(hard/soft/diffused/sharp/blurred shadow)；方向(cast left/cast right/long/short shadow)；位置(face in shadow/half in shadow/fully shadowed/shadow on wall/shadow on ground)；特殊(silhouette/cast shadow/multiple shadows/no shadow)\n' +
                    'E6.反射与折射：反射面(mirror/water/glass/metal/floor/eye reflection)；反射内容（反射了什么：人物/风景/光源）；折射(through glass/through water/lens flare/prism effect/distortion)；反光(specular highlight/glossy reflection/shiny surface)\n' +
                    'E7.特殊光效：volumetric light, god rays, light beams, light particles, dust in light, bokeh, lens flare, bloom, glow, glowing, neon glow, candle flicker, firelight flicker, screen glow, moonlight glow\n' +
                    'E8.光影与情绪：温暖亲密(warm lamp light+soft shadow+golden glow+low contrast)；紧张恐惧(harsh side light+hard shadow+high contrast+cold blue+darkness)；神圣希望(backlighting+rim light+god rays+volumetric light+bright glow)；忧郁孤独(dim light+large shadow+cool blue+low key+single light source)；激情热烈(warm red/orange+high contrast+dynamic lighting+flickering light)；日常平静(natural window light+soft diffused+neutral white+even lighting)\n' +
                    '\n' +
                    '=== F. 氛围元素谱系 ===\n' +
                    'F1.色调：主色调(warm/cool/neutral tones, monochrome, sepia, black and white)；具体色调(red/blue/green/purple/pink/golden theme, pastel/vibrant/muted/faded colors, high/low saturation, complementary/analogous colors)；情绪色（见色彩修辞）\n' +
                    'F2.空气感：清澈(clear air/crisp/transparent)；浑浊(hazy/misty/foggy/smoggy/dusty)；微粒(dust particles/floating dust/pollen/ash/snowflakes/raindrops/petals/leaves/sparkles/light particles/motes)；水汽(steam/mist/vapor/breath vapor/humidity/condensation)\n' +
                    'F3.颗粒与质感：胶片感(film grain/grainy/analog/35mm/polaroid/vintage photo)；数字感(clean/smooth/digital/sharp/high definition)；绘画感(brush strokes/painterly/textured/canvas texture)；特殊(noise/static/glitch/distortion/chromatic aberration)\n' +
                    'F4.动态感：静止(still/static/frozen/motionless)；缓慢(slow motion/gentle movement/drifting/floating)；快速(speed lines/motion blur/fast movement/action lines/dynamic)；震动(trembling/shaking/vibrating/quivering)；流动(flowing/streaming/pouring/cascading)\n' +
                    'F5.情绪基调（视觉化）：温馨(warm tones+soft light+cluttered but cozy+wooden texture+ambient lamp+blanket+steam from cup)；压抑(low ceiling+dim light+cold tones+cramped space+hard shadow+muted colors+bars/frames)；孤独(wide empty space+single small figure+negative space+cool tones+distant+back view)；紧张(dutch angle+high contrast+hard shadow+tight framing+red accents+motion lines)；浪漫(warm glow+soft focus+bokeh+petals+golden hour+close proximity+eye contact)；恐怖(darkness+high contrast+bottom lighting+distorted+cold tones+fog+obscured faces)；怀旧(sepia+faded colors+film grain+soft focus+warm tones+vintage objects)；活力(bright saturated colors+dynamic angle+motion lines+sunlight+open space+smile)\n' +
                    '\n' +
                    '=== 元素遍历执行规则 ===\n' +
                    '1.生成每个画面单元前，列出本图所有可见元素。2.对每个元素按对应谱系检查填充了多少属性维度。3.每个可见元素至少填充2个属性维度，核心元素（视觉核心相关）至少填充4个维度。4.填充属性时必须保证属性之间的逻辑一致性（如"丝绸"配"柔软垂坠"不配"硬挺"，"夜晚"配"人工光源"不配"明亮阳光"）。5.不要求填充所有维度，选择与剧情最相关、最能传递情绪的维度。6.调用角色预设/服装预设后仍需从本谱系补充状态类、动态类、交互类属性（预设只包含基础外观）。7.背景元素也需要填充属性，不能只写blurry background——至少写清楚背景是什么空间、有什么物件、光线如何。\n' +
                    '\n' +
                    '【风格媒介库】\n' +
                    'AI在单图决策Step 7中选择风格媒介。默认使用与正文一致的写实/动漫风格，但应根据叙事性质主动探索非默认风格。\n' +
                    '\n' +
                    '=== 一、写实类 ===\n' +
                    '1.【照片写实】photorealistic, realistic, hyperrealistic。适用：真实感/冲击力/恐怖/悬疑/纪实。tag：photorealistic, realistic, hyperdetailed, raw photo, 8k, dslr, shallow depth of field\n' +
                    '2.【电影感】cinematic, film still, movie scene。适用：戏剧性强、需要氛围和镜头感。tag：cinematic, film still, cinematic lighting, anamorphic, film grain, color graded, 2.35:1\n' +
                    '3.【纪实摄影】documentary, street photography, candid。适用：日常/真实/未经编排；旁观者视角。tag：documentary, candid, natural lighting, street photography, unposed, grainy\n' +
                    '\n' +
                    '=== 二、动漫类 ===\n' +
                    '4.【现代动漫】anime style, modern anime, 2d animation。适用：默认风格，大多数叙事场景。tag：anime style, 2d, cel shading, clean lineart, anime coloring\n' +
                    '5.【复古动漫】90s anime, retro anime, vintage anime。适用：怀旧/回忆/旧时代背景。tag：90s anime, retro artstyle, 1990s, vintage anime, soft colors, film grain\n' +
                    '6.【赛璐璐动画】cel animation, classic anime。适用：干净/明快/卡通感。tag：cel shading, flat colors, hard shadow, clean outline, cartoon\n' +
                    '\n' +
                    '=== 三、绘画类 ===\n' +
                    '7.【油画】oil painting, painterly, classical painting。适用：庄重/古典/戏剧性/艺术感。tag：oil painting, painterly, brush strokes, classical art, rich colors, impasto\n' +
                    '8.【水彩】watercolor, watercolour, soft painting。适用：梦幻/温柔/回忆/自然/抒情。tag：watercolor, watercolour, soft edges, transparent, wash, paper texture, delicate\n' +
                    '9.【素描/速写】sketch, pencil drawing, charcoal, lineart。适用：草稿感/构思/紧张/朴素。tag：sketch, pencil drawing, charcoal, monochrome sketch, lineart, hatching, rough\n' +
                    '10.【版画/木刻】woodblock print, ukiyo-e, linocut。适用：日式/传统/装饰性/风格化。tag：ukiyo-e, woodblock print, flat colors, bold outline, japanese art\n' +
                    '11.【印象派】impressionism, monet style。适用：户外/光影/氛围重于细节。tag：impressionism, visible brushstrokes, light and color, outdoor painting, soft focus\n' +
                    '\n' +
                    '=== 四、数字与实验类 ===\n' +
                    '12.【像素艺术】pixel art, 8bit, 16bit。适用：复古游戏/Q版/怀旧/可爱。tag：pixel art, 8bit, 16bit, pixelated, limited palette, retro game\n' +
                    '13.【赛博朋克】cyberpunk, neon, sci-fi。适用：未来/科技/都市夜景/反乌托邦。tag：cyberpunk, neon lights, futuristic, high contrast, rain, holographic, techwear\n' +
                    '14.【蒸汽朋克】steampunk, victorian sci-fi。适用：维多利亚+机械/复古未来/冒险。tag：steampunk, brass, gears, steam, victorian, mechanical, leather\n' +
                    '15.【极简主义】minimalist, simple, flat design。适用：概念性/象征性/情绪纯粹。tag：minimalist, simple, flat colors, negative space, geometric, clean\n' +
                    '16.【超现实】surrealism, surreal, dreamlike。适用：梦境/幻觉/心理/荒诞。tag：surrealism, surreal, dreamlike, floating objects, impossible space, symbolic\n' +
                    '17.【故障艺术】glitch art, vaporwave, distortion。适用：数字世界/精神错乱/系统崩溃/迷幻。tag：glitch, chromatic aberration, scanlines, distortion, digital noise, vaporwave\n' +
                    '\n' +
                    '=== 五、Q版与可爱类 ===\n' +
                    '18.【Q版/SD】chibi, sd, super deformed。适用：搞笑/可爱/心理活动/日常轻松。tag：chibi, sd, super deformed, big head, cute, simplified, 2heads\n' +
                    '19.【手绘涂鸦】doodle, sketchy, hand drawn。适用：随意/亲切/非正式/想象场景。tag：doodle, sketchy, hand drawn, messy lines, cute, informal\n' +
                    '\n' +
                    '=== 风格选择规则 ===\n' +
                    '1.同一次请求内的多个画面、以及不同时空（回忆/想象/现实）可以用不同风格（如当前写实、回忆褪色复古、想象水彩/超现实）。2.风格选择必须与叙事性质一致，不能为了"炫技"乱换风格。3.同一场景/同一时空的画面应保持风格一致。4.如果选择非默认风格，必须说明选择依据（可内部完成）。5.风格tag写在Scene Composition中，与其他tag并列。6.风格不替代细节——即使是极简风格，核心元素的属性仍需从「视觉元素谱系」中填充。\n' +
                    '\n' +
                    '【tag 组装规范（image### 块）】\n' +
                    '输出块必须为以下完整结构（智绘姬渲染按钮的硬性要求，缺一不可）：\n' +
                    '<image>\n' +
                    'regex:【该单元正文的末尾一句原文，用于智绘姬在消息中定位按钮插入位置；取末尾一句，最多40字，超出截取末尾40字】\n' +
                    'image###\n' +
                    'Scene Composition:...\n' +
                    '必须按以下模块顺序组装，每个模块至少 1 个 tag，模块间逗号分隔：\n' +
                    '[人数构成] + [空间类型] + [前景元素] + [中景元素] + [背景元素，公共场景追加crowd] + [时间] + [光源+方向] + [阴影/氛围] + [色调] + [视觉核心强调，必要时加权{}] + [风格] + [镜头角度+景别]\n' +
                    'Character 1 Prompt:\n' +
                    '必须按以下模块顺序组装，模块间逗号分隔：\n' +
                    '[角色英文名(动漫名)] + [外貌特征，标志性特征{}加权] + [服装(类型+颜色+材质+状态)] + [面朝方向] + [视线目标] + [姿势] + [手部姿势] + [表情+微表情] + [支撑/接触面] + [动作细节] + [交互 source#/target#] + |centers:位置\n' +
                    '（手部不可见时写 hands out of frame；全裸时服装模块替换为 nude + 身体状态 tag）\n' +
                    'Character 1 UC: 根据画面中的人物1需要排除的负面tag；多人画面增加其他角色标志性外貌作为负面，规避特征混淆\n' +
                    '【三人以上依次追加Character3、Character4区块，格式统一】\n' +
                    '（无人画面：不写 Character 区块，Scene Composition 写清楚环境/物件主体）\n' +
                    '###\n' +
                    '\n' +
                    '###提示词生成指导(提示词必须是英文):\n' +
                    'Scene Composition:\n' +
                    '1.人物数量构成：1girl, 1boy, 2girls, 2boys, 3girls, 3boys, 1milf, 2milfs, 1 old man, 1 old woman 等，自由组合（两个女孩一个男孩→2girls,1boy）。\n' +
                    '2.包含环境设定：outdoor、vegetation、Port Towns in Italy 等，构建画面背景。\n' +
                    '3.包含特殊元素：white flower Backgrounds、beautiful detailed eyes 等，强调画面特定元素。\n' +
                    '4.当前时间：morning, noon or night, emphasize the lighting situation.\n' +
                    '5.人物此时的位置：diningroom, gym, bedroom, indoors, home, beach 等。\n' +
                    '6.镜头描写：从前往下看/上半身还是下半身；选择最具有冲击力的镜头。lower_body, between_legs, between_breasts, pantyshot, looking_at_viewer。\n' +
                    '7.光影风格：侧光、顶光、背光、自然光，夜晚无光、场景灯光等。\n' +
                    '8.空间深度：必须明确划分前景/中景/背景/远景，每层至少有一个具体元素tag。禁止纯平涂背景（除非叙事明确为抽象空间）。\n' +
                    '9.光影系统：必须包含光源tag + 光线方向tag + 阴影/氛围tag（window light, side lighting, soft shadow）。多人画面所有角色阴影方向统一。\n' +
                    '10.视觉核心强调：Scene Composition中必须有tag明确指向视觉核心。核心是物件→object focus + 具体物件；核心是光影→light focus + 具体光效；核心是空间→scenery + wide shot。禁止视觉核心不明确。\n' +
                    '11.色调与情绪：至少一个色调tag和一个情绪氛围tag，必须与叙事情绪匹配。\n' +
                    '12.风格媒介：必须包含风格tag（anime style, oil painting, watercolor, realistic, cinematic 等）。\n' +
                    'Character Prompt:\n' +
                    '1.女性角色的英文全名，动漫角色加动漫名称（格式示范：Satoru Gojo (Jujutsu Kaisen) 即"角色英文名 (作品名)"，仅示范命名格式）。角色英文名必须放在Prompt最前面。禁止只用外貌描述代替角色名——"white hair, blue eyes"画不出角色。\n' +
                    '2.人物外貌：年龄、发型发色、瞳色、体型，标志性特征使用{{}}提升权重。\n' +
                    '3.人物服装：区分上衣、下装、饰品，写明颜色、材质、状态。\n' +
                    '4.人物表情动作：smile, crying 等基础表情搭配微表情。\n' +
                    '5.人物姿势：站姿、坐姿、各类互动姿势。\n' +
                    '6.动作细节：肢体摆放、手部位置。\n' +
                    '7.环境交互：角色与场景、角色与角色互动。\n' +
                    '8.衣物细节：半脱、破损、湿身状态。\n' +
                    '9.人物交互（极为重要）：用 source# 和 target# 表示两个角色间的互相接触，source#=主动做动作的一方，target#=被动接受的一方，用大括号括起来。\n' +
                    '10.面朝与视线（强制配对）：每个可见面部的角色必须同时写面朝方向和视线目标，且二者逻辑一致。面朝：facing viewer/facing away/facing left/facing right/profile/three quarter view。视线：looking at viewer/looking at another/eye contact/looking away/looking down/looking up/gazing at [对象]/closed eyes/empty eyes。禁止 facing away + looking at viewer 这类矛盾组合。\n' +
                    '11.手部（强制项）：手部可见必须写手部姿势tag；手部不可见必须写 hands out of frame 或 hidden hands。手部姿势要具体到手指状态。\n' +
                    '12.支撑与接触（强制项）：每个角色必须有明确支撑点（站在地面/坐在椅子上/躺在床上/被人抱着/漂浮）。有接触时必须写明接触部位和接触性质（轻触/紧握/拥抱/按压/拉扯）。\n' +
                    '13.服装系统：至少包含类型+层次+颜色+材质+状态。\n' +
                    '14.身体状态：根据剧情合理追加皮肤状态、生理状态、临时状态tag。\n' +
                    '15.微表情：基础表情之外至少追加一个微表情tag（nose blush, sweatdrop, trembling lips, furrowed brow, half-lidded eyes）。\n' +
                    'Character UC:\n' +
                    '1.排除负面tag：one arms, lowres, aliasing, jaggy lines, bad hands, one legs。\n' +
                    '2.多人同框：互相添加对方角色标志性外貌特征作为负面标签，防止特征混淆。\n' +
                    '3.排除不匹配当前画面的动作、服饰。\n' +
                    'centers:\n' +
                    '1.centers表示人物所在相对位置，用1-5表示行数，a-e表示列数。中心位置是c3。\n' +
                    '2.尽量不要使用边缘位置（a1, e5），边缘位置图片容易变形。人物位置可以重叠（抱在一起）。\n' +
                    '3.两个人左右互动推荐b3、d3；拥抱、近距离互动推荐c3、c3或c3、d3。\n' +
                    '4.三人及以上合理排布，保证空间距离符合叙事。\n' +
                    '5.5人及以上示例：a3、b3、c3、d3、e2；超过6人时核心角色分配具体centers，其余用crowd/silhouette处理。\n' +
                    '\n' +
                    '【调度硬性规则】\n' +
                    '1.【强制链路绑定】先完整执行视觉导演工作流全部阶段完成画面决策→在视觉修辞与叙事焦点中挑选适配修辞→使用视觉一致性工程8维度逐项校验→只有校验全部通过才允许组装prompt标签。所有决策结论（叙事功能/视觉核心/时空切片/视点/景别角度/修辞）100%转化写入正向提示词，禁止仅存放于思考区、遗漏、篡改、私自替换设定；选定的视觉修辞对应标签必须写入正面提示词；校验发现画面缺陷立刻修改构思重新校验，不得带着错误构思直接生成标签。\n' +
                    '2.【正文信息绑定】最终画面必须至少包含一个可识别的正文关键信息：角色、地点、时间、天气、道具、动作、关系状态。禁止生成与正文无明显关联的泛化图片。正文提及的关键物品必须出现在画面合理位置。\n' +
                    '3.【空间坐标系强制约束】多人画面内所有人物共享同一套透视、光源、地面平面，禁止人物各自独立渲染如同拼贴图层；镜头原点必须明确（镜头在角色前方/后方/侧方/上方/下方），所有人物的站位、朝向、视线都必须相对于同一个镜头原点成立；视线、朝向、肢体交互三者强绑定（A看向B→A面部朝向B+A视线矢量落在B躯体范围+两人空间距离符合叙事）；肢体接触必须有物理支撑依据，标注接触部位写入tag，禁止无接触的悬浮式互动；角色相对身高、体型比例严格遵循人设设定，禁止AI随机缩放人物大小。\n' +
                    '4.【角色特征隔离】多个角色同框时，Character1、Character2及更多角色的外貌、发色、瞳色、标志性特征互相独立；在各自角色UC区域添加负面标签规避特征渗透（例：角色A的UC添加角色B的标志性特征词，如角色B是栗发，则角色A的UC加chestnut hair）；标志性人设特征（痣、特殊发型、瞳色）使用{}进行权重加强，避免特征混淆丢失。\n' +
                    '5.【场景环境填充】密闭私人空间（卧室、独立书房）可空旷；公共多人场景（教室、街道、餐厅、礼堂），若无正文明确说明空无一人，必须补充适量背景路人群像crowd，背景人物不抢夺视觉核心，作为远景虚化处理；环境道具匹配文本时代、场景类型，杜绝违和物件凭空出现；所有文本提及的物品必须出现在画面合理位置。\n' +
                    '6.【人数弹性】单图人数不设固定上限，严格按照正文叙事决定出场人数；叙事明确出现三人及以上时画面必须容纳对应数量角色，不可擅自删减；三人及以上时核心角色必须分配独立Character区块；超过4人时非核心背景人物使用crowd、silhouette、background figures处理。\n' +
                    '7.【Danbooru tag 规则】禁用重复tag（同义词库自动去重，如：全裸/男性全裸/女性全裸）；禁用质量tag（masterpiece、high quality、very aesthetic）；禁用引号"或\'；省略画面中因物品遮挡导致不显示部位的tag（戴眼罩→省略眼睛，戴口罩→省略嘴巴，戴耳罩→省略耳朵）；多人时添加male、female前缀区分，防止人物动作、交互混淆。\n' +
                    '8.【单图决策清单】（每个画面单元内部执行，不输出外壳；tag映射确认为强制项）：\n' +
                    '- 叙事功能：本图承担什么功能？（建立场景/推进情节/积累张力/高潮爆发/情绪收束/视角切换/信息揭示/氛围铺垫/其他）\n' +
                    '- 视觉核心：观众的目光最终应该落在哪里、感受到什么？（人物表情/物件/光/空间/色彩/抽象意象）明确核心后所有tag服务突出核心；Scene Composition中明确写入视觉核心类型：object focus/light focus/character focus/scenery focus/action focus，必要时{}加权。\n' +
                    '- 时空切片：当前时刻/回忆闪现/想象推演/预示幻象/平行可能/时间叠合。非当前时刻必须说明与正文的关系。\n' +
                    '- 视点：角色主观/过肩/旁观/全知/物件视角/无人视角。视点决定观众能看到什么、不能看到什么，以及画面的情绪倾向。\n' +
                    '- 视觉修辞：从「视觉修辞与叙事焦点」中选择，可使用多种，说明选择依据。\n' +
                    '- 风格媒介：从「风格媒介库」中选择，说明依据——不是默认写实，而是根据叙事性质主动选择。\n' +
                    '- 人数裁定：本图实际需要几人？每人的叙事角色（核心/陪体/背景）？被排除在画面外的人说明原因，禁止无理由删减人物。\n' +
                    '- 空间建模：①空间类型（具体空间tag，如living room/bedroom/street）②前景元素（离镜头最近的物体）③中景元素（核心动作区域）④背景元素（远处环境，公共场景补crowd）⑤遮挡关系（谁挡住谁的哪个部位）⑥支撑关系（每个角色的支撑点）⑦透视（一点/两点/三点透视，灭点大致位置，多人画面共享同一透视体系）\n' +
                    '- 光影建模：①主光源（类型+方向，如window light from left/ceiling lamp from top/candle from front）②辅光源/反射光（无则写无）③色温（warm/cool/neutral/golden/blue tint）④强度（bright/soft/dim/harsh）⑤阴影（方向+软硬，所有角色阴影方向统一）⑥亮部区域⑦暗部区域⑧特殊光效（bokeh/volumetric light/rim light，无则写无）\n' +
                    '- 一致性校验：8维度（人体结构/空间透视/物理交互/光影一致/语义对齐/时空一致/角色连续/因果逻辑）+ 额外强制3项（角色视线与朝向必须匹配/人物相对身高体型比例符合人设/禁止图层拼贴式人物），每项回答"通过"或"问题+修正方案"\n' +
                    '- 元素遍历：列出每个可见元素及属性维度——角色：外貌/服装/姿势/表情/手部/面朝/视线；核心物件：类型/材质/颜色/状态；环境：空间类型/前景/中景/背景/光线/色调。每个至少2维度，视觉核心相关元素至少4维度。列出后检查：有没有可见但未列出的元素？\n' +
                    '- tag映射确认（重点强化）：写image###之前逐项确认以下内容写入tag（每项"已写入"或"遗漏→补充"）：①空间建模的前景/中景/背景→Scene Composition有对应tag？②光影建模的光源/方向/色温/阴影→Scene有对应tag？③视觉修辞→有对应构图/光影/色彩tag？④视觉核心→Scene明确写入类型并加权？⑤每个角色的面朝方向→Character写了facing？⑥每个角色的视线目标→Character写了looking？（视线与朝向冲突=严重遗漏）⑦每个可见手部→写了手部姿势tag？不可见→hands out of frame？⑧每件服装→类型+颜色+材质+状态？⑨每个角色→至少1个微表情tag？标志性特征{}加权？⑩UC→基础负面词+多人特征互斥负面tag？⑪风格媒介→Scene有风格tag？⑫色调情绪→Scene有色调tag？⑬交互动作source#/target#绑定完整写入？任何一项遗漏，必须在tag中补充后再输出。\n' +
                    '9.【动态演出tag】正文存在明显动态表现（性爱、吵架、运动、亲吻、肢体互动等）时追加强化tag：{speed lines}, {motion lines}, {trembling}, {spoken heart}, {sound effects}。使用规则：speed lines用于快速动作/冲击/爆发/扑抱/猛然转身；motion lines用于动作轨迹/肢体移动/挥动/拉扯/伸手/转身；trembling用于身体轻颤/害羞/紧张/激动/忍耐/战栗；spoken heart/sound effects用于害羞/紧张/激动等状态。静态、平稳、普通站立、普通对视不使用这些tag。动态演出tag应与动作tag、表情tag、镜头tag一同使用，自然融入整体tag中，而不是单独堆砌。\n' +
                    '\n' +
                    '【参考示例】（仅演示"正文→决策→tag"的组装格式；角色与场景均为占位，使用 (Original Character) 命名法，必须按注入正文的实际角色与场景生成，禁止照搬示例的外貌/服装/互动）\n' +
                    '输入单元（插件切分的一段正文）：\n' +
                    '正文：傍晚的客厅，女孩窝在男孩怀里，他用勺子喂她吃冰淇淋，她闭着眼张嘴，暖橘色的夕阳从窗户照进来。\n' +
                    '对应输出图块：\n' +
                    '<image>\n' +
                    'regex:暖橘色的夕阳从窗户照进来。\n' +
                    'image###Scene Composition: 1girl, 1boy, living room, coffee table, sofa, large window, curtain, evening, sunset light from left, window light, soft shadow, warm tones, golden hour, rim light, light particles, framed by window, cozy atmosphere, anime style, from side, {medium shot};\n' +
                    'Character 1 Prompt: (Original Character:1.3), 1girl, 17yo, {{chestnut long wavy hair}}, {{mole under left eye}}, petite, cute face, white silk camisole dress, thin straps, soft fabric, bare shoulders, facing right, eyes closed, sitting on lap, leaning back against chest, one hand on own knee, happy, open mouth, blush, relaxed, bare feet, {target#embrace from behind}, {target#feeding}|centers: c3;\n' +
                    'Character 1 UC: bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, mutated hands, bad proportions, extra limbs, missing limbs, mutation, deformed, disfigured, poorly drawn face, lowres, text, watermark, black short hair, dark eyes;\n' +
                    'Character 2 Prompt: (Original Character:1.3), 1boy, {{black short hair}}, {{dark eyes}}, tall, handsome, sharp features, grey cotton t-shirt, black casual shorts, relaxed fit, facing left, looking at girl, sitting on sofa, legs spread, holding spoon, one arm around waist, gentle smile, half-lidded eyes, {source#embrace from behind}, {source#feeding}|centers: c3;\n' +
                    'Character 2 UC: bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, mutated hands, bad proportions, extra limbs, missing limbs, mutation, deformed, disfigured, poorly drawn face, lowres, text, watermark, chestnut hair, mole under eye;###\n' +
                    '</image>\n' +
                    '\n' +
                    '（示例说明：该输入单元信息密集（人物互动+表情），故用人物镜头medium shot；若输入单元是纯环境描写段落，则 Scene Composition 写环境主体+无人/远景，不写 Character 区块。）\n' +
                    '\n' +
                    '</L·Bridge生图规则·油猴世界书二改>\n' +
                    '\n';
    function log() { if (settings.debug && window.console) console.log.apply(console, ['[L·Bridge]'].concat([].slice.call(arguments))); }

    // 持久化：多级 fallback（全局函数 → getContext() → window），避免 IIFE 环境下静默丢失
    function persist() {
        try {
            var ctx = getCtx();
            if (ctx && typeof ctx.saveSettingsDebounced === 'function') { ctx.saveSettingsDebounced(); return true; }
        } catch (e) {}
        try {
            if (typeof saveSettingsDebounced !== 'undefined') { saveSettingsDebounced(); return true; }
        } catch (e) {}
        try {
            if (typeof window.saveSettingsDebounced === 'function') { window.saveSettingsDebounced(); return true; }
        } catch (e) {}
        return false;
    }

    function findRuleEntry() {
        try {
            var ctx = getCtx();
            if (ctx && ctx.worldInfo && Array.isArray(ctx.worldInfo)) {
                // v2.89：worldinfo 模式下优先返回用户勾选的条目（不用标记）
                if (settings.ruleSource === 'worldinfo' && Array.isArray(settings.selectedWorldInfoUids) && settings.selectedWorldInfoUids.length) {
                    for (var j = 0; j < ctx.worldInfo.length; j++) {
                        var wj = ctx.worldInfo[j];
                        if (!wj || !wj.content) continue;
                        var uidj = String(wj.uid || wj.id || '');
                        if (settings.selectedWorldInfoUids.indexOf(uidj) !== -1) return wj;
                    }
                }
                // 原有逻辑：找带标记的条目（兼容旧用法）
                for (var i = 0; i < ctx.worldInfo.length; i++) {
                    var w = ctx.worldInfo[i];
                    if (!w || !w.content) continue;
                    var comment = String(w.comment || '');
                    var keys = Array.isArray(w.key) ? w.key.join(' ') : String(w.key || '');
                    if (comment.indexOf(RULE_TAG) !== -1 || keys.indexOf('rpgimg_rule') !== -1) return w;
                }
            }
        } catch (e) {}
        return null;
    }
    function getRulePrompt() {
        var w = findRuleEntry();
        if (settings.ruleSource === 'worldinfo') {
            if (w) return w.content;
            if (window.toastr) toastr.warning('L·Bridge：未找到标记的世界书条目，回退内置规则');
            return BUILTIN_PROMPT;
        }
        if (settings.ruleSource === 'builtin') return BUILTIN_PROMPT;
        if (settings.ruleSource === 'flower') return BUILTIN_PROMPT_FLOWER;
        if (settings.ruleSource === 'preset') {
            var c = settings.rulePresets && settings.rulePresets[settings.selectedRulePreset];
            if (c) return c;
            if (window.toastr) toastr.warning('L·Bridge：未找到选中的规则预设，回退内置规则');
            return BUILTIN_PROMPT;
        }
        return w ? w.content : BUILTIN_PROMPT;
    }

    var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

    // 按 settings.stripTags 动态生成"非正文标签块"剥离（<tag>...</tag> 整块不参与切分配图）。
    // pad=true 时替换为等长空格（stripExtras 用，保持坐标）；pad=false 替换为单个空格（cleanBody 用，归一化后一致）。
    function stripTagBlocks(s, pad) {
        var tags = Array.isArray(settings.stripTags) ? settings.stripTags : [];
        var out = String(s == null ? '' : s);
        tags.forEach(function (t) {
            if (!t) return;
            var esc = String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            var re;
            try { re = new RegExp('<' + esc + '[^>]*>[\s\S]*?<\/' + esc + '>', 'gi'); } catch (e) { return; }
            out = out.replace(re, function (m) { return pad ? new Array(m.length + 1).join(' ') : ' '; });
        });
        return out;
    }
    // 解析预设作者的正则 json（SillyTavern 格式），自动提取其中的自定义标签名
    // 兼容：数组 / {regex_scripts:[...]} / {scripts:[...]} / {regexes:[...]}（RegexBinding）/ 任意含数组的对象
    function extractTagsFromRegex(text) {
        var obj = null;
        try { obj = JSON.parse(String(text || '')); } catch (e) { return { tags: [], err: '不是合法 JSON：' + e.message }; }
        var list = [];
        if (Array.isArray(obj)) list = obj;
        else if (obj && Array.isArray(obj.regex_scripts)) list = obj.regex_scripts;
        else if (obj && Array.isArray(obj.scripts)) list = obj.scripts;
        else if (obj && Array.isArray(obj.regexes)) list = obj.regexes;
        else if (obj && typeof obj === 'object') {
            for (var k in obj) { if (Array.isArray(obj[k]) && obj[k].length) { list = obj[k]; break; } }
        }
        if (!list.length) return { tags: [], err: '未在文件里找到正则脚本数组' };
        var HTML = { p:1,div:1,span:1,details:1,summary:1,br:1,hr:1,table:1,tr:1,td:1,th:1,a:1,img:1,b:1,i:1,em:1,strong:1,ul:1,ol:1,li:1,h1:1,h2:1,h3:1,h4:1,h5:1,h6:1,blockquote:1,code:1,pre:1,ruby:1,rt:1,section:1,article:1,body:1,html:1,head:1,style:1,script:1,font:1,center:1,sup:1,sub:1,u:1,s:1,mark:1,small:1,big:1,svg:1,path:1,line:1,rect:1,circle:1,text:1,form:1,input:1,button:1,label:1,select:1,option:1,textarea:1,nav:1,main:1,footer:1,header:1,aside:1,figure:1,figcaption:1 };
        var SKIP = { content:1, image:1, imgthink:1, p:1, q:1, wf:1 }; // 结构标签不能剥
        var tags = {};
        list.forEach(function (r) {
            var fr = r && (r.findRegex || r.find || '');
            if (!fr) return;
            fr = String(fr).replace(/^\/([\s\S]*)\/[a-z]*$/i, '$1'); // 去掉 /…/flags 包装
            var re = /<[\s\/]*([A-Za-z0-9_\-\u4e00-\u9fa5]{2,40})/g;
            var m;
            while ((m = re.exec(fr))) {
                var t = m[1];
                var tl = String(t).toLowerCase();
                if (HTML[tl] || SKIP[tl]) continue;
                if (/^(?:style|class|id|data-|onclick|onload)/i.test(t)) continue;
                tags[t] = (tags[t] || 0) + 1;
            }
        });
        var arr = Object.keys(tags).sort(function (a, b) { return tags[b] - tags[a]; });
        return { tags: arr, total: list.length };
    }
    function cleanBody(mes) {
        if (!mes) return '';
        var body = stripTagBlocks(mes, false); // ①先剥非正文标签块（thinking 里的假 content 标签一并消失）
        var m = body.match(/<content[^>]*>([\s\S]*?)<\/content>/gi);
        if (m && m.length) body = m[m.length - 1].replace(/<\/?content[^>]*>/gi, '');
        body = body.replace(/<image[^>]*>[\s\S]*?<\/image>/gi, ' '); // 剥成空格：不破坏段落边界
        body = body.replace(/<imgthink[^>]*>[\s\S]*?<\/imgthink>/gi, '');
        body = body.replace(/image###[\s\S]*?###/g, '');
        body = body.replace(/<!--[\s\S]*?-->/g, ' '); // 先剥完整 HTML 注释，防内容含 '>' 截断残渣
        body = body.replace(/<[^>]+>/g, ' ');
        body = body.replace(/\[VoiceTag:[^\]]*\]/gi, ' ');
        return body;
    }
    function getParagraphs(text) {
        if (!text) return [];
        var endsWithBlank = /\n\s*\n\s*$/.test(text);
        var parts = text.split(/\n{2,}/);
        var out = [];
        parts.forEach(function (p, i) {
            var t = p.replace(/\s+/g, ' ').trim();
            if (!t || t.length < 2) return;
            out.push({ text: t, complete: i < parts.length - 1 || endsWithBlank });
        });
        return out;
    }
    // 按句切分（橙光式：一句一画面），短句并入前句
    function splitSentences(text) {
        if (!text) return [];
        var raw = text.replace(/\s+/g, ' ').trim();
        var pieces = raw.match(/[^。！？…!?；;]*[。！？…!?；;]?/g) || [];
        var out = [];
        pieces.forEach(function (p) {
            var t = p.trim();
            if (!t) return;
            if (t.length < 6 && out.length) { out[out.length - 1] += ' ' + t; return; } // 保留句间空格：定位文本须与 cNorm 一致，否则整句匹配失败会拆句
            out.push(t);
        });
        return out.map(function (t) { return { text: t, complete: true }; });
    }
    // 每 N 段合并成一个画面单元
    function splitNParagraphs(text) {
        var paras = getParagraphs(text).map(function (p) { return p.text; });
        var step = Math.max(1, parseInt(settings.paraStep, 10) || 2);
        var out = [];
        for (var i = 0; i < paras.length; i += step) {
            out.push({ text: paras.slice(i, i + step).join('\n\n'), complete: true });
        }
        return out;
    }
    // 自动粒度：按内容密度自适应
    // - 段落 ≤25字（橙光式碎段）→ 与相邻碎段合并，合计超过60字就切一个单元
    // - 25~60字 → 整段一个单元
    // - >60字（长段落）→ 内部按句切分，一句一图
    function splitAuto(text) {
        if (!text) return [];
        var paras = getParagraphs(text);
        var out = [];
        var pending = '';
        function flush() {
            if (pending.trim()) { out.push({ text: pending.trim(), complete: true }); pending = ''; }
        }
        paras.forEach(function (p) {
            var t = p.text;
            if (t.length <= 25) {
                if (pending && (pending.length + t.length) > 60) flush();
                pending = pending ? pending + ' ' + t : t;
                return;
            }
            if (t.length <= 60) { flush(); out.push({ text: t, complete: true }); return; }
            flush();
            splitSentences(t).forEach(function (s) { out.push(s); });
        });
        flush();
        return out;
    }
    // 把切好的单元按每N个合并成一个画面单元（N=1 即每单元一图）
    function chunkUnits(units, n) {
        var step = Math.max(1, parseInt(n, 10) || 1);
        var out = [];
        for (var i = 0; i < units.length; i += step) {
            var seg = units.slice(i, i + step).map(function (u) { return u.text; }).join(' ');
            if (seg.trim()) out.push({ text: seg.trim(), complete: true });
        }
        return out;
    }
    // 按设置的粒度切分正文：
    //  - auto：按内容密度自适应（短段一段一图/长段拆句/碎段合并）
    //  - sentence：按句切，每 granStep 句合并一图（N=1 即一句一图）
    //  - paragraph：按段切，每 granStep 段合并一图（N=1 即一段一图）
    // 用户改这里的选项即时生效，不需要改世界书/预设
    // AI 把世界书规则复述/剧情规划写进正文区时（如"<content>正文（橙光式短段落…）SDC-end注释…好，让我开始规划正文。本轮剧情大纲：…"），
    // 这些"残留段"不能配图：命中规则术语的段直接过滤，防止垃圾图 + 图块插进 thinking/规划区
    function isRuleJunk(t) {
        return /橙光式|SDC-end|SDC-start|故事考据|短信标签|论坛标签|让我开始规划|开始规划正文|本轮剧情大纲|让我想想怎么安排|对话量|对白量|自言自语算对白|时间设定：/.test(String(t || ''));
    }
    function splitSegments(text) {
        var mode = settings.granularity || 'auto';
        var n = parseInt(settings.granStep, 10) || 1;
        var out;
        if (mode === 'sentence') out = chunkUnits(splitSentences(text), n);
        else if (mode === 'paragraph') out = chunkUnits(getParagraphs(text), n);
        else if (mode === 'npara') out = chunkUnits(getParagraphs(text), settings.paraStep || 2);
        else out = splitAuto(text);
        return out.filter(function (p) { return !isRuleJunk(p.text); });
    }
    // 自动（正文锚点）模式：正文 AI 在"值得配图"的段末埋 <!--配图--> 标记。
    // 画面单元 = 相邻标记之间的正文（含标记的段落后才配图）；标记后的无标记正文不配图（画面保持上一张）。
    // v2.83：画面单元 ≠ 自然段（VN 按【换行+图块占位】切画面），同段可多锚点（每句一锚点），
    // 每个锚点 = 一个独立画面 = 一张图；锚点间至少间隔一句完整文本（连续锚点空单元会被丢弃）。
    function splitByImageMarkers(mes) {
        if (!mes || (mes.indexOf('<!--配图-->') === -1 && mes.indexOf('<!--配图|') === -1)) return [];
        // v2.83：先取【最后一个 <content> 对】内部再切分（与 cleanBody/insertBlocksIntoMessage 同源）——
        // 主 AI 输出的 thinking/规划文本/globalTime 等在 content 外，直接按原文切片会让它们混进首单元
        // （图API输入污染、指纹错乱、定位失配）。无 content 标签时回退原文。
        var inner = String(mes);
        var cm = inner.match(/<content[^>]*>([\s\S]*?)<\/content>/gi);
        if (cm && cm.length) {
            var last = cm[cm.length - 1].replace(/^<content[^>]*>/i, '').replace(/<\/content>$/i, '');
            if (last && last.trim()) inner = last;
        }
        // v2.96：保存 content 内部原文（供「前文注入」按锚点位置截取本片之前的正文）
        gRawInner = inner;
        // v2.96：支持带画面意图的锚点 <!--配图|画面意图-->，意图随切片透传给图API
        var re = /<!--\s*配图\s*(?:\|([^>]*?))?\s*-->/g, marks = [], m;
        while ((m = re.exec(inner)) !== null) marks.push({ start: m.index, end: m.index + m[0].length, intent: (m[1] || '').trim() });
        if (!marks.length) return [];
        // 闭符号归位：正文 AI 常把 <!--配图--> 埋在句末标点后、结束引号/括号前（如 ？" 之间），
        // 导致结束引号落在标记后成为孤立字符，VN 按图块占位切段时把它切成单独一段。
        // 修复：标记后紧跟闭引号/闭括号时，把标记起点跳到闭符号之后（闭符号并入本单元，图块插在闭符号后）。
        var closerRe = /^[""'」》』】）)\]}]/;
        for (var i = 0; i < marks.length; i++) {
            var mk0 = marks[i];
            var after = inner.slice(mk0.end, mk0.end + 1);
            if (closerRe.test(after)) {
                var before = mk0.start > 0 ? inner[mk0.start - 1] : '';
                if (before && before !== '\n' && mk0.end + 1 <= inner.length) {
                    mk0.start = mk0.end + 1; // 跳过标记+闭符号：闭符号并入本单元
                    mk0.end = mk0.start;
                }
            }
        }
        // 连续锚点（锚点间无文本）安全：下方空单元（cleanBody 后 <2 字）会被丢弃，不产生图块。
        var keep = marks;
        var out = [];
        // 首单元：content 正文起点 → 第一个保留标记前
        var prevEnd = 0;
        keep.forEach(function (mk) {
            // 先删除本单元范围内已被"消费"的配图标记（闭符号归位跳过的标记），
            // 避免 cleanBody 把它们剥成空格残留在单元文本里（如 ？" 之间出现空格）
            var raw = inner.slice(prevEnd, mk.start).replace(/<!--\s*配图\s*(?:\|([^>]*?))?\s*-->/g, '');
            var t = cleanBody(raw).replace(/\s+/g, ' ').trim();
            if (t && t.length >= 2) out.push({ text: t, complete: true, start: prevEnd, intent: mk.intent || '' });
            prevEnd = mk.end;
        });
        // 标记后的剩余正文：无标记 → 不配图，丢弃
        return out;
    }
    // 统一入口：自动（正文锚点）模式优先解析 <!--配图--> 标记（须用原始消息，cleanBody 会剥掉标记）；
    // 无标记或手动模式回退 splitSegments（按句/按段机械划分）
    function splitSegmentsForMes(mes) {
        var raw = (mes && mes.mes !== undefined) ? mes.mes : mes;
        if (settings.granularity === 'anchor') {
            var byMark = splitByImageMarkers(raw);
            if (byMark && byMark.length) return byMark;
        }
        return splitSegments(cleanBody(raw));
    }
    function extractParagraphs(mes) { return splitSegmentsForMes(mes).map(function (p) { return p.text; }); }
    // 解析消息里已有图块的锚点标记 <!--rpgda-seg:序号:指纹--> → {序号: 指纹}
    // v2.89: 只认插件插入时写的专属标记 rpgda-seg；正文 AI 自带的 <!--seg:-->（Ninedc&Deach 输出模板）
    // 不再被误判为"已插入图块"（否则增量模式会误报"已全部配图"）。
    function parseSegAnchors(mes) {
        var set = {};
        if (!mes) return set;
        var re = /<!--\s*rpgda-seg:\s*(\d+)(?::([^>]*?))?\s*-->/gi, m;
        while ((m = re.exec(mes)) !== null) set[parseInt(m[1], 10)] = (m[2] || '');
        return set;
    }

    // 从智绘姬(st-chatu8)读取启用角色的形象预设（支持多角色）：
    // 优先读「角色启用预设」characterEnablePresets[characterEnablePresetId].characters[]（一个预设可含多个角色），
    // 兜底读单角色 characterPresetId。每个角色的五官外貌/身体部位/角色tag注入图API参考。
    function getZhiHuiJiCharacterDesc() {
        try {
            var ctx = getCtx();
            if (!ctx || !ctx.extensionSettings) return '';
            var ext = ctx.extensionSettings.st_chatu8 || ctx.extensionSettings['st-chatu8'] || null;
            if (!ext) return '';
            var presets = ext.characterPresets || {};
            var charNames = [];
            // 1) 优先：当前选中的【角色启用预设】（智绘姬的聊天框/角色卡启用列表，可含多个角色）
            var epId = ext.characterEnablePresetId || '';
            var ep = (epId && ext.characterEnablePresets) ? ext.characterEnablePresets[epId] : null;
            if (ep && Array.isArray(ep.characters)) {
                ep.characters.forEach(function (entry) {
                    var nm = (entry && typeof entry === 'object') ? (entry.characterPresetName || entry.name || entry.presetName) : entry;
                    if (nm && typeof nm === 'string' && nm.trim()) charNames.push(nm.trim());
                });
            }
            // 2) 兜底：老式单角色预设
            if (!charNames.length && ext.characterPresetId) charNames.push(ext.characterPresetId);
            if (!charNames.length) charNames.push('默认角色');
            var labels = {
                facialFeatures: '五官外貌',
                facialFeaturesBack: '五官外貌(背面)',
                upperBodySFW: '上半身(SFW)',
                upperBodySFWBack: '上半身背面(SFW)',
                fullBodySFW: '全身(SFW)',
                fullBodySFWBack: '全身背面(SFW)',
                upperBodyNSFW: '上半身(NSFW)',
                fullBodyNSFW: '全身(NSFW)',
                fullBodyNSFWBack: '全身背面(NSFW)'
            };
            var rendered = [];
            charNames.forEach(function (pid) {
                var p = presets[pid] || presets['默认角色'] || null;
                if (!p) return;
                var parts = [];
                var nm = [p.nameCN, p.nameEN].filter(Boolean).join('/');
                if (nm) parts.push('角色名：' + nm);
                Object.keys(labels).forEach(function (k) {
                    var v = p[k];
                    if (v && String(v).trim()) parts.push(labels[k] + '：' + String(v).trim());
                });
                if (Array.isArray(p.tags) && p.tags.length) parts.push('角色tag：' + p.tags.join(', '));
                if (parts.length) rendered.push(parts.join('\n'));
            });
            if (!rendered.length) return '';
            return '【智绘姬启用角色（共' + rendered.length + '个）】\n' + rendered.join('\n\n');
        } catch (e) { return ''; }
    }

    // 从已生成的 <image> 块提取「一致性DNA」（角色/场景关键特征），供后续片请求保持前后一致。
    // 提取：Scene Composition 的场景词 + Character Prompt 的角色词（NAI 权重语法 `{x}`/`[x]`/`x:1.2` 一并剥掉）。
    var dnaByTitle = {};
    function extractDna(block) {
        if (!block) return '';
        try {
            var out = [];
            var m1 = block.match(/Scene Composition:([^;]*)/i);
            if (m1 && m1[1]) {
                var scene = String(m1[1]).replace(/\{[^}]*\}|\[[^\]]*\]|\([^)]*\)|:\s*[0-9.]+|best quality|amazing quality|very aesthetic|absurdres|newest|year 20\d\d|single frame|cinematic still|cinematic lighting|depth of field|film grain|wide shot|full body|medium shot|solo|\{[^}]*\}/gi, '').split(',').map(function (s) { return s.trim(); }).filter(function (s) { return s && s.length > 1; });
                if (scene.length) out.push('场景:' + scene.slice(0, 6).join(','));
            }
            // v2.96.4: 多角色支持——提取 Character 1/2/3（及更多）Prompt，按出现顺序标号，
            // 补"多角色场景只有 Character 1 进 DNA、后续批次角色特征丢失"的洞
            var ci = 1;
            for (; ci <= 6; ci++) {
                var m2 = block.match(new RegExp('Character\\s*' + ci + '\\s*Prompt:([^;]*)', 'i'));
                if (!m2 || !m2[1]) continue;
                var char = String(m2[1]).replace(/\{[^}]*\}|\[[^\]]*\]|\([^)]*\)|:\s*[0-9.]+/gi, '').split(',').map(function (s) { return s.trim(); }).filter(function (s) { return s && s.length > 1 && !/^best quality|^amazing quality|^very aesthetic|^absurdres|^newest|^year 20\d\d|^single frame|^cinematic still|^cinematic lighting|^depth of field|^film grain/i.test(s); });
                if (char.length) out.push('角色' + ci + ':' + char.slice(0, 6).join(','));
            }
            return out.join('；');
        } catch (e) { return ''; }
    }
    function pushTitle(arr, block) {
        var title = (block.match(/【([^】]*)】/) || [])[1] || '';
        if (!title) return;
        if (arr.indexOf(title) === -1) {
            arr.push(title);
            var dna = extractDna(block);
            if (dna) dnaByTitle[title] = dna;
        }
    }
    // 当前配图消息的完整正文（cleanBody 后纯文本）：注入给图模型，让它看到整场戏，保持角色服装/场景/状态一致
    var gFullText = '';
    // v2.96：content 内部原文（供「前文注入」按锚点位置截取本片之前的正文）与「静态设定块」文本
    var gRawInner = '';
    var gStaticBlock = '';
    // v2.96.3：从消息原文提取正文 AI 输出的静态设定块（本条从头到尾一致的画面事实）
    // 格式①（推荐，v2.96.3 起）：单个完整注释 <!--静态设定：内容-->（内容包在注释内，界面才隐藏）
    // 格式②（兼容旧消息）：配对注释 <!--静态设定-->内容<!--/静态设定-->（只有标记是注释，中间内容会显示）
    function extractStaticBlock(mes) {
        try {
            var raw = String(mes || '');
            // 格式①：单个完整注释
            var m1 = raw.match(/<!--\s*静态设定\s*[:：]\s*([\s\S]*?)-->/i);
            if (m1 && m1[1]) return m1[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            // 格式②：配对注释（旧格式兼容）
            var m = raw.match(/<!--\s*静态设定\s*-->([\s\S]*?)<!--\s*\/静态设定\s*-->/i);
            if (m && m[1]) return m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            // 兼容未闭合写法：只取开标记到正文首个配图锚点之间
            var m2 = raw.match(/<!--\s*静态设定\s*-->([\s\S]*?)(?:<!--\s*配图|<\/(?:静态设定|content)>)/i);
            if (m2 && m2[1]) return m2[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        } catch (e) {}
        return '';
    }
    // v2.96：取「到 upToStart 为止的前文」（content inner 原文 → cleanBody 纯文本），供前文注入。
    // upToStart 为数字（锚点模式）时按偏移精确截取，即使为空也绝不全文注入（防剧透）；
    // upToStart 为 null/undefined（手动模式/流式）时回退当前已生成全文（此时全文天然=前文，无剧透问题）
    function getPrefixText(upToStart) {
        try {
            if (typeof upToStart === 'number' && gRawInner) {
                var seg = gRawInner.slice(0, upToStart).replace(/<!--\s*配图\s*(?:\|([^>]*?))?\s*-->/g, '');
                return cleanBody(seg).replace(/\s+/g, ' ').trim();
            }
        } catch (e) {}
        return gFullText;
    }
    function buildFullContext(upToStart) {
        var parts = [];
        var budget = settings.maxContextLen || 6000;
        var push = function (label, text) {
            if (!text || !text.trim()) return;
            var t = text.trim();
            if (budget <= 0) return;
            parts.push('【' + label + '】\n' + (t.length > budget ? t.slice(0, budget) : t));
            budget -= Math.min(t.length, budget);
        };
        try {
            var ctx = getCtx();
            if (!ctx) return parts.join('\n\n');
            // v2.96：静态设定块（正文 AI 在消息开头写的本条全程一致的画面事实：场景/时间/天气/服装/妆发/物品）——
            // 优先级高于一切，图模型据此定义本条全局一致性，禁止更改
            if (gStaticBlock && gStaticBlock.trim()) {
                parts.push('【本条静态设定（本条消息从头到尾一致的画面事实，最高优先级：场景/时间/天气/角色服装/妆发/标志物品以此为准，禁止更改或自创；其中角色/场景的英文标识与英文特征串必须逐字采用，禁止重译/改写/省略/自行发明）】\n' + gStaticBlock.slice(0, 6000));
            }
            // v2.96：前文注入（到当前片为止的正文）取代全文注入——图模型只看到本画面之前已发生的内容，
            // 不知道后面剧情，从根上消除「后图填补空白导致剧透」；无锚点/手动模式回退全文
            var ft = getPrefixText(upToStart);
            if (ft && ft.trim()) {
                var fts = ft.length > 20000 ? ft.slice(0, 20000) : ft;
                parts.push('【当前画面之前的剧情（前文，本画面之前已发生的剧情：角色服装/场景/人物状态必须与已发生剧情一致，禁止自创；禁止描绘尚未发生的剧情）】\n' + fts);
            }
            if (settings.injectCharacter) {
                var c = getCurrentCharacter();
                if (c) push('当前角色设定', [c.name, c.description].filter(Boolean).join('\n'));
            }
            if (settings.injectCharacter) {
                var zhjDesc = getZhiHuiJiCharacterDesc();
                if (zhjDesc) push('智绘姬角色形象预设（最高优先级：角色形象必须逐字采用此预设，禁止漂移/改写/自行发明）', zhjDesc);
            }
            if (settings.injectHistory && ctx.chat && Array.isArray(ctx.chat)) {
                var n = Math.max(1, parseInt(settings.historyTurns, 10) || 4);
                var recent = ctx.chat.slice(-(n + 1), -1).map(function (m) {
                    var body = cleanBody(m.mes || '');
                    body = body.replace(/\s+/g, ' ').trim();
                    return (m.is_user ? '[User] ' : '[AI] ') + body;
                }).filter(function (s) { return s.length > 4; });
                if (recent.length) push('最近剧情', recent.join('\n'));
            }
            if (settings.injectWorldInfo && ctx.worldInfo && Array.isArray(ctx.worldInfo)) {
                var wis = ctx.worldInfo.filter(function (w) { return w && w.constant && w.content; }).map(function (w) { return w.content; });
                if (wis.length) push('世界书常驻设定', wis.join('\n'));
            }
        } catch (e) {}
        return parts.join('\n\n');
    }
    // 后续片上下文 = 完整注入（角色+智绘姬形象+最近剧情+世界书常驻）+ 前面已生成画面的一致性DNA。
    // 与 buildFullContext 同源，绝不再砍注入内容；只额外追加「前面已生成的画面」（含 DNA）。
    function buildLightContext(doneTitles, upToStart) {
        var parts = [];
        var budget = settings.maxContextLen || 6000;
        var push = function (label, text) {
            if (!text || !text.trim()) return;
            var t = text.trim();
            if (budget <= 0) return;
            parts.push('【' + label + '】\n' + (t.length > budget ? t.slice(0, budget) : t));
            budget -= Math.min(t.length, budget);
        };
        try {
            var ctx = getCtx();
            if (ctx) {
                // v2.96：静态设定块（最高优先级，本条全程一致的画面事实）
                if (gStaticBlock && gStaticBlock.trim()) {
                    parts.push('【本条静态设定（本条消息从头到尾一致的画面事实，最高优先级：场景/时间/天气/角色服装/妆发/标志物品以此为准，禁止更改或自创；其中角色/场景的英文标识与英文特征串必须逐字采用，禁止重译/改写/省略/自行发明）】\n' + gStaticBlock.slice(0, 6000));
                }
                // v2.96：前文注入取代全文注入（见 buildFullContext 注释）
                var ft = getPrefixText(upToStart);
                if (ft && ft.trim()) {
                    var fts = ft.length > 20000 ? ft.slice(0, 20000) : ft;
                    parts.push('【当前画面之前的剧情（前文，本画面之前已发生的剧情：角色服装/场景/人物状态必须与已发生剧情一致，禁止自创；禁止描绘尚未发生的剧情）】\n' + fts);
                }
                if (settings.injectCharacter) {
                    var c = getCurrentCharacter();
                    if (c) push('当前角色设定', [c.name, c.description].filter(Boolean).join('\n'));
                }
                if (settings.injectCharacter) {
                    var zhjDesc = getZhiHuiJiCharacterDesc();
                    if (zhjDesc) push('智绘姬角色形象预设（最高优先级：角色形象必须逐字采用此预设，禁止漂移/改写/自行发明）', zhjDesc);
                }
                if (settings.injectHistory && ctx.chat && Array.isArray(ctx.chat)) {
                    var n = Math.max(1, parseInt(settings.historyTurns, 10) || 4);
                    var recent = ctx.chat.slice(-(n + 1), -1).map(function (m) {
                        var body = cleanBody(m.mes || '');
                        body = body.replace(/\s+/g, ' ').trim();
                        return (m.is_user ? '[User] ' : '[AI] ') + body;
                    }).filter(function (s) { return s.length > 4; });
                    if (recent.length) push('最近剧情', recent.join('\n'));
                }
                if (settings.injectWorldInfo && ctx.worldInfo && Array.isArray(ctx.worldInfo)) {
                    var wis = ctx.worldInfo.filter(function (w) { return w && w.constant && w.content; }).map(function (w) { return w.content; });
                    if (wis.length) push('世界书常驻设定', wis.join('\n'));
                }
            }
            // 前面已生成的画面：标题 + DNA（角色/场景关键特征），供模型保持前后一致性
            if (doneTitles && doneTitles.length) {
                var prev = doneTitles.map(function (t) {
                    var dna = dnaByTitle[t];
                    return dna ? ('【' + t + '】(' + dna + ')') : ('【' + t + '】');
                });
                push('前面已生成的画面（保持角色/场景一致性）', prev.join('\n'));
            }
            // 最近已生成画面的完整图块原文（自回归记忆链）：模型直接参考上一片画面的服装/场景/状态，
            // 比 DNA 摘要更具体——"下一片注入上一片"，让后续画面向最近画面看齐。
            // 独立额度（不受 maxContextLen 限制），放在 ctxBlock 末尾，离正文段最近、参考权重最高。
            try {
                var recentBlocks = getRecentBlocks(3);
                if (recentBlocks && recentBlocks.length) {
                    parts.push('【最近已生成画面（完整图块，角色服装/场景/人物状态必须与这些画面保持一致，禁止更改服装颜色款式）】\n' + recentBlocks.join('\n'));
                }
            } catch (e) {}
        } catch (e) {}
        return parts.join('\n\n');
    }

    // 取最近 N 个已成功生成的完整图块（非流式 job.blocks / 流式 stream.results），供后续片参考
    function getRecentBlocks(n) {
        var arr = [];
        try {
            if (job && job.active && Array.isArray(job.blocks)) {
                arr = job.blocks.filter(function (b) { return b && String(b).indexOf('<image') === 0; });
            } else if (stream && stream.results) {
                arr = Array.from(stream.results.values()).filter(function (b) { return b && String(b).indexOf('<image') === 0; });
            }
        } catch (e) {}
        return arr.slice(-Math.max(1, parseInt(n, 10) || 3));
    }

    // fetch 带超时（AbortController，默认90秒）。超时抛 AbortError，由调用方转成友好提示。
    // 注意：不用 window.top.fetch——ST 主窗口的 fetch 可能被劫持并随全局事件被 abort（表现为秒级 AbortError）；
    // 扩展与酒馆同源，直接用自身 fetch + CSRF 头即可。
    function fetchWithTimeout(url, opts, ms) {
        var doFetch = (typeof fetch === 'function') ? fetch.bind(window) : null;
        if (!doFetch && window.top && window.top.fetch) doFetch = window.top.fetch.bind(window.top);
        var t = Math.max(1000, parseInt(ms, 10) || 90000);
        var start = Date.now();
        if (typeof AbortController !== 'undefined') {
            var ctrl = new AbortController();
            opts = opts || {};
            opts.signal = ctrl.signal;
            var timer = setTimeout(function () { try { ctrl.abort(); } catch (e2) {} }, t);
            return doFetch(url, opts).finally(function () { clearTimeout(timer); }).catch(function (err) {
                if (err && err.name === 'AbortError') {
                    var el = Date.now() - start;
                    var ne = new Error('请求被中止（已等待' + el + 'ms，超时设定' + t + 'ms）：' + url);
                    ne.name = 'AbortError';
                    throw ne;
                }
                throw err;
            });
        }
        return doFetch(url, opts || {});
    }

    // 规范化 OpenAI 兼容 base URL（照 ST-SevenDaysCal 的 api/sse.js）：
    // '.../v1/chat/completions' → 去掉尾部端点；裸域名 → 加 /v1；自定义路径 → 原样保留
    function normalizeApiUrl(url) {
        var u = String(url || '').trim().replace(/\/+$/, '');
        if (!u) return u;
        if (/\/chat\/completions$/i.test(u)) return u.replace(/\/chat\/completions$/i, '');
        if (/^https?:\/\/[^/?#]+$/i.test(u)) return u + '/v1';
        return u;
    }

    // 读取输入框实时值（用户可能填了没保存）
    function fieldVal(id) {
        try {
            var $ = window.jQuery;
            if (!$) return null;
            var el = $('#' + id);
            if (!el || !el.length) return null;
            var v = el.val();
            return (v === undefined || v === null) ? null : String(v).trim();
        } catch (e) { return null; }
    }

    async function callImgAPI(segments, ctxBlock, intents) {
        if (!settings.apiKey) { logErr('图API请求', new Error('API Key 为空：请先在插件设置里填写并点「保存设置」，再重试（前序按片请求因此全部未发出）')); if (window.toastr) toastr.warning('L·Bridge：请先在设置里保存API Key'); return null; }
        if (!settings.apiUrl) { logErr('图API请求', new Error('API 端点为空：请填写或从酒馆导入')); if (window.toastr) toastr.warning('L·Bridge：请先填写API端点'); return null; }
        if (!settings.model) { logErr('图API请求', new Error('模型名为空：请填写或拉取模型')); if (window.toastr) toastr.warning('L·Bridge：请先填写模型名'); return null; }
        var sys = getRulePrompt();
        // v2.96：意图透传——正文 AI 在锚点上写的「画面意图」随段落一起交给图API，明确该画面要表现什么，
        // 让图API在"中间态/过渡空白"场景下也能按意图落图，而不是靠猜或靠下一张图填补
        var user = (ctxBlock ? ctxBlock + '\n\n---\n\n' : '') +
            '以下是文游正文段落，每段用【P{序号}】开头。请参考角色设定与剧情上下文，为每段生成对应的背景图块，严格按段落顺序输出，每段一个 <image>…</image> 块，禁止合并与遗漏。\n\n' +
            segments.map(function (p, i) {
                var s = '【P' + (i + 1) + '】' + p;
                if (intents && intents[i]) s += '\n（画面意图：' + intents[i] + '）';
                return s;
            }).join('\n\n');
        var messages = [
            { role: 'system', content: sys },
            { role: 'user', content: user }
        ];
        // 破限提示词注入：启用时按所选位置拼接到 system 或 user prompt（在 messages 构建之后、请求发出之前修改 content）
        if (settings.breakLimitEnabled && settings.breakLimitPrompt) {
            var blp = String(settings.breakLimitPrompt || '').trim();
            if (blp) {
                switch (settings.breakLimitPos) {
                    case 'system_prefix': messages[0].content = blp + '\n\n' + messages[0].content; break;
                    case 'system_suffix': messages[0].content = messages[0].content + '\n\n' + blp; break;
                    case 'user_prefix': messages[1].content = blp + '\n\n' + messages[1].content; break;
                    case 'user_suffix': messages[1].content = messages[1].content + '\n\n' + blp; break;
                }
                logInfo('破限提示词', '已注入到 ' + (settings.breakLimitPos || 'system_prefix') + '，' + blp.length + ' 字');
            }
        }
        var reqUrl = settings.apiUrl;
        var reqHeaders = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + settings.apiKey };
        var payload = {
            model: settings.model,
            messages: messages,
            temperature: settings.temperature,
            max_tokens: settings.maxTokens,
            stream: false
        };
        // v2.96.1：酒馆代理选项已从 UI 移除，但请求链路保留「酒馆服务端代理优先、直连兜底」的自动探测——
        // 填裸域名（如 https://api.example.com）时浏览器直连拿不到数据（CORS/混合内容/路径拼装），
        // 必须走酒馆同源代理 /api/backends/chat-completions/generate（reverse_proxy 自动拼 /v1/chat/completions）
        var _ctxP = null;
        try { _ctxP = getCtx(); } catch (e) {}
        if (_ctxP && typeof _ctxP.getRequestHeaders === 'function') {
            try {
                reqUrl = '/api/backends/chat-completions/generate';
                reqHeaders = _ctxP.getRequestHeaders();
                payload = {
                    chat_completion_source: 'openai',
                    reverse_proxy: normalizeApiUrl(settings.apiUrl),
                    proxy_password: settings.apiKey,
                    model: settings.model,
                    messages: messages,
                    temperature: settings.temperature,
                    max_tokens: settings.maxTokens,
                    stream: false
                };
                logInfo('图API请求', '走酒馆服务端代理（自动探测）');
            } catch (e) {
                // 代理拼装失败 → 回退直连
                reqUrl = settings.apiUrl;
                reqHeaders = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + settings.apiKey };
                payload = {
                    model: settings.model,
                    messages: messages,
                    temperature: settings.temperature,
                    max_tokens: settings.maxTokens,
                    stream: false
                };
            }
        }
        logInfo('图API请求', '发出请求：' + segments.length + ' 段，端点 ' + reqUrl + '，模型 ' + (settings.model || '未填') + '，每次超时' + (settings.requestTimeout || 150) + '秒，429/5xx最多自动重试3次');
        var _st = { t: new Date(), segs: segments.length, ok: false, blocks: 0, retries: 0, promptTok: 0, compTok: 0, err: '' };
        // 429/5xx 自动重试：指数退避（2s→4s），429 优先读 Retry-After（最多等60秒），重试不阻塞其他段的处理
        var MAX_ATT = 3;
        var resp = null;
        var lastErr = null;
        var waitMs = 0;
        var _attCount = 0;
        for (var att = 0; att < MAX_ATT; att++) {
            if (att > 0) _attCount++;
            if (att > 0) {
                waitMs = 2000 * Math.pow(2, att - 1);
                logInfo('图API请求', '自动重试第 ' + (att + 1) + '/' + MAX_ATT + ' 次，等待 ' + waitMs + 'ms（遇到429/5xx）');
                await sleep(waitMs);
            }
            try {
                resp = await fetchWithTimeout(reqUrl, {
                    method: 'POST',
                    headers: reqHeaders,
                    body: JSON.stringify(payload)
                }, (settings.requestTimeout || 150) * 1000);
            } catch (e) {
                lastErr = e;
                // AbortError（超时/被中止）也重试——瞬时错误，重试大概率救回；重试信息里带上耗时
                logInfo('图API请求', '请求失败（' + (e && e.message ? e.message : e) + '），自动重试第 ' + (att + 1) + '/' + MAX_ATT + ' 次');
                continue;
            }
            if (resp.ok) break;
            var t0 = await resp.text().catch(function () { return ''; });
            lastErr = new Error('HTTP ' + resp.status + ' ' + t0.slice(0, 200));
            if (resp.status === 429 || resp.status >= 500) {
                if (resp.status === 429) {
                    try {
                        var ra = parseInt(resp.headers.get('retry-after'), 10);
                        if (ra > 0) { var extra = Math.min(60000, ra * 1000) - waitMs; if (extra > 0) { await sleep(extra); } }
                    } catch (e2) {}
                }
                if (att < MAX_ATT - 1) continue;
                break;
            }
            break;
        }
        if (!resp || !resp.ok) {
            if (!lastErr) lastErr = new Error('图API请求失败（未知原因）');
            if (!(lastErr.message && lastErr.message.indexOf('图API请求超时') === 0)) logErr('图API请求（重试耗尽）', lastErr);
            _st.err = lastErr && lastErr.message ? String(lastErr.message).slice(0, 120) : '失败';
            _st.retries = _attCount;
            reqStats.list.push(_st);
            throw lastErr;
        }
        var data = await resp.json();
        var text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
        var blocks = text.match(/<image[^>]*>[\s\S]*?<\/image>/gi) || [];
        if (data && data.usage) {
            _st.promptTok = data.usage.prompt_tokens || 0;
            _st.compTok = data.usage.completion_tokens || 0;
        }
        if (!blocks.length) {
            // 0 图块 = 模型被并发限流返回空/格式不符：按失败重试（串行时大概率能救回），避免全部掉进缺失回收
            logInfo('图API请求', '模型返回 0 个图块（疑似并发限流/格式不符），按失败重试');
            _st.err = '0图块';
            reqStats.list.push(_st);
            throw new Error('图API返回0图块');
        }
        logInfo('图API请求', '成功返回 ' + blocks.length + ' 个图块');
        _st.ok = true; _st.blocks = blocks.length; _st.retries = _attCount; _st.err = '';
        reqStats.list.push(_st);
        return blocks;
    }

    async function fetchModels() {
        var key = settings.apiKey;
        var url = settings.apiUrl;
        var kv = fieldVal('rpgda-key');
        var uv = fieldVal('rpgda-url');
        if (kv) key = kv;
        if (uv) url = uv;
        if (!key) { if (window.toastr) toastr.warning('请先填写API Key（即使未保存也会读取输入框）'); return null; }
        if (!url) { if (window.toastr) toastr.warning('请先填写图API端点'); return null; }
        // v2.96.1：酒馆代理选项已从 UI 移除，但「酒馆服务端代理优先、直连兜底」保留——
        // 裸域名端点（https://api.xxx 无 /v1 无 /chat/completions）直连 /models 往往被网关/前端路由拦成 HTML，
        // 走酒馆代理 status 接口（reverse_proxy 自动拼 /v1）才能拉到真实模型列表
        try {
            var ctxM = getCtx();
            if (ctxM && typeof ctxM.getRequestHeaders === 'function') {
                var respM;
                try {
                    respM = await fetchWithTimeout('/api/backends/chat-completions/status', {
                        method: 'POST',
                        headers: ctxM.getRequestHeaders(),
                        body: JSON.stringify({
                            chat_completion_source: 'openai',
                            reverse_proxy: normalizeApiUrl(url),
                            proxy_password: key
                        })
                    }, 30000);
                } catch (e) {
                    if (e && e.name === 'AbortError') throw new Error('酒馆代理请求超时（30秒）。若你的酒馆版本不支持此接口，请把「apiUrl」配成完整的直连地址（含 /v1/chat/completions）');
                    throw e;
                }
                var textM = await respM.text().catch(function () { return ''; });
                if (!respM.ok) {
                    throw new Error('酒馆代理HTTP ' + respM.status + '：' + textM.slice(0, 200));
                }
                var dataM = JSON.parse(textM);
                var rawM = [];
                if (dataM && dataM.data && Array.isArray(dataM.data)) rawM = dataM.data;
                else if (Array.isArray(dataM)) rawM = dataM;
                else if (dataM && Array.isArray(dataM.models)) rawM = dataM.models;
                var idsM = rawM.map(function (m) {
                    if (!m) return '';
                    if (typeof m === 'string') return m;
                    return m.id || m.name || String(m);
                }).filter(Boolean);
                if (idsM.length) { if (window.toastr) toastr.info('已通过酒馆服务端代理拉到 ' + idsM.length + ' 个模型'); return idsM; }
                if (window.toastr) toastr.warning('酒馆代理返回空模型列表，改用直连');
            }
        } catch (e) {
            if (e && e.message && e.message.indexOf('酒馆代理') === 0) throw e;
            if (window.toastr) toastr.warning('酒馆代理不可用，改用直连：' + (e && e.message ? e.message : e));
        }
        // 直连兜底：用 normalizeApiUrl 拼 /models（裸域名补 /v1，避免打到前端路由返回 HTML）
        var modelsUrl = normalizeApiUrl(url).replace(/\/+$/, '') + '/models';
        var resp2;
        try {
            resp2 = await fetchWithTimeout(modelsUrl, {
                method: 'GET',
                headers: { 'Authorization': 'Bearer ' + key }
            }, 30000);
        } catch (e) {
            if (e && e.name === 'AbortError') throw new Error('直连请求超时（30秒）：' + modelsUrl);
            throw e;
        }
        var text2 = await resp2.text().catch(function () { return ''; });
        if (!resp2.ok) {
            throw new Error('直连HTTP ' + resp2.status + '，返回内容: ' + text2.slice(0, 200));
        }
        var data2 = null;
        try {
            data2 = JSON.parse(text2);
        } catch (e) {
            throw new Error('直连返回的不是JSON（unexpected token）。请求URL: ' + modelsUrl + '。返回内容开头: ' + text2.slice(0, 200));
        }
        var raw2 = (data2 && data2.data && Array.isArray(data2.data) ? data2.data : (Array.isArray(data2) ? data2 : []));
        var ids2 = raw2.map(function (m) {
            if (!m) return '';
            if (typeof m === 'string') return m;
            return m.id || m.name || String(m);
        }).filter(Boolean);
        return ids2;
    }

    // 与 cleanBody 同源的"等长空格"清理：正文里的 VoiceTag/标签/imgthink 等换成等长空格，
    // 字符位置不变，保证定位文本与切分文本(cleanBody 后)完全一致；不破坏原文
    function stripExtras(text) {
        if (!text) return text;
        var pad = function (m) { return new Array(m.length + 1).join(' '); };
        return stripTagBlocks(text, true)
            .replace(/<image[^>]*>[\s\S]*?<\/image>/gi, pad)
            .replace(/<imgthink[^>]*>[\s\S]*?<\/imgthink>/gi, pad)
            .replace(/image###[\s\S]*?###/g, pad)
            .replace(/<!--[\s\S]*?-->/g, pad)
            .replace(/<[^>]+>/g, pad)
            .replace(/\[VoiceTag:[^\]]*\]/gi, pad);
    }
    // 段文本指纹：归一化后取前10字符+长度，用于增量补图时"按文本锚定已有图"（切分设置变化也能对上）
    function segFingerprint(text) {
        var t = String(text || '').replace(/\s+/g, '').replace(/[，。！？、；：""''「」『』（）()【】《》,.!?;:'"\-—…~～\s]/g, '').toLowerCase();
        return t.slice(0, 10) + ':' + t.length;
    }
    // 由"新切分段落 + 锚点表(序号→指纹)"计算 existing 映射：指纹优先，旧无指纹锚点按序号兜底
    function computeExistingMap(segs, anch) {
        var ex = {};
        if (!segs || !anch) return ex;
        var byFp = {};
        Object.keys(anch).forEach(function (k) { if (anch[k]) byFp[anch[k]] = parseInt(k, 10); });
        segs.forEach(function (s, i) {
            var fp = segFingerprint(s);
            if (byFp[fp] !== undefined) ex[i] = true;
            else if (anch[i] !== undefined && (!anch[i] || anch[i] === fp)) ex[i] = true;
        });
        return ex;
    }
    // 按 segs（切分单元）精确定位插入：同一份正文、同一套切分，杜绝二次切分不一致导致插不进去
    // 在指定文本上按 segs 顺序定位并插入图块，返回 {newContent, inserted, failed}
    // ===== v2.79 智绘姬兼容兜底 =====
    // 智绘姬渲染"生图按钮"的硬性要求：每个 <image> 块必须同时包含 regex: 定位行 + image###...### 标记。
    // gemini 常漏输出 image### 前缀、且从不输出 regex（FLOWER 规则此前没要求）→ 按钮不渲染。
    // 这里在插入前统一规范化：缺 image### 补前缀；缺 regex 用该单元末尾一句（≤40字，与智绘姬截断一致）补定位行。
    function chatuNormalizeBlock(img, segText) {
        if (!img) return img;
        var inner = String(img).replace(/^<image[^>]*>/i, '').replace(/<\/image>\s*$/i, '').trim();
        if (!inner) return img;
        var hasTag = /image###/i.test(inner);
        var hasRegex = /regex\s*:/i.test(inner);
        var seg = String(segText || '').replace(/\s+/g, ' ').trim();
        var tail = seg ? seg.slice(-40) : '';
        var body = [];
        if (hasTag) {
            // 提取 image###...### 的纯 tag 内容，重新包回统一格式
            var tm = inner.match(/image###([\s\S]*?)(?:###\s*)?$/);
            var tagContent = tm ? tm[1].trim() : inner.replace(/^[\s\S]*?image###/i, '').replace(/###\s*$/, '').trim();
            if (hasRegex) {
                // 已有 regex 行：原样保留（放在 tag 前）
                var rm = inner.match(/regex:[^\n]*/i);
                if (rm) body.push(rm[0]);
            }
            body.push('image###' + tagContent + '###');
        } else {
            // 无 image###：整个 inner 当作 tag 内容（若内含 regex 行，智绘姬也能解析）
            body.push('image###' + inner + '###');
        }
        if (!hasRegex && tail) body.unshift('regex:' + tail);
        return '<image>\n' + body.join('\n') + '\n</image>';
    }
    // 防嵌套：插入点若位于 HTML 标签内部/边界处时，把它挪到安全位置。
    // v2.83 重写（旧版把"段尾后、锚点前"的 endIdx 误判成位于未闭合标签内，把插入点推到段首
    // 草稿注释的 '<' 处，导致每块都插到"模拟段落"注释后/段首）。
    // 规则（按优先级）：
    //  ① endIdx 正好落在闭标签 '<' 前（段末紧跟 </p> 等）→ 移到该闭标签之后（块在标签外、段落后）
    //  ② endIdx 前的最近 '<' 是【完整闭合】的注释/标签 → 不动（块贴在段尾、锚点前）
    //  ③ endIdx 前的最近 '<' 无 '>'（开标签被截断，endIdx 在标签内部）→ 移到 '<' 之前
    function safeInsertPoint(content, endIdx) {
        var after = content.slice(endIdx);
        var cm = after.match(/^<\/[a-zA-Z][^>]*>/);
        if (cm) return endIdx + cm[0].length;
        var before = content.slice(0, endIdx);
        var i = before.lastIndexOf('<');
        if (i !== -1) {
            var seg = before.slice(i);
            var gt = seg.indexOf('>');
            if (!/^<!--[\s\S]*-->$/.test(seg) && !/^<\/[a-zA-Z]/.test(seg) && gt === -1) {
                return i;
            }
        }
        return endIdx;
    }

    // v2.83：图块包裹方式（替代 v2.81 的 <div style="display:none"> 整块包裹）。
    // v2.81 的 display:none div 会把智绘姬插入的"生成图片"按钮一起藏进隐藏容器 → 按钮看不见（本轮回归）。
    // 智绘姬的按钮 = 在 DOM 里匹配 image###...### → 删除原文 → 原地插按钮（按钮样式固定，不继承父容器）。
    // 所以：image### 必须裸放（按钮插在可见位置）；regex 定位行是给 parseImagesFromPrompt 用的机器信息，
    // 用 display:none 的 span 隐藏（智绘姬的按钮匹配只看 image###，span 不影响；parse 从原文读 regex 不受 span 影响）。
    // VN：cleanBody 先剥 <image> 块成占位，span 在块内一并剥掉，占位保留。
    function wrapImageBlock(img, segLabel) {
        // regex 行（image 块内第一行）包进 display:none span；image### 保持裸放
        var img2 = String(img || '').replace(/^(<image[^>]*>\s*\n?)(regex:[^\n]*)/i, '$1<span style="display:none">$2\n</span>');
        return img2 + segLabel;
    }

    // v2.84：旧格式迁移——把 v2.81 版生成的 <div style="display:none"> 整块包裹图块
    // （按钮被智绘姬插进隐藏容器 → 不可见）转成 v2.83 格式（regex 行 span 隐藏 + image### 裸放），
    // 旧消息的"生成图片"按钮恢复可见；对已按 v2.83 生成的图块/无 div 的消息原样返回。
    function migrateLegacyDivBlocks(mes) {
        if (!mes || typeof mes !== 'string') return mes;
        if (mes.indexOf('display:none') === -1 || mes.indexOf('<div') === -1) return mes;
        var re = /<div[^>]*style="[^"]*display\s*:\s*none[^"]*"[^>]*>\s*(<image[^>]*>[\s\S]*?<\/image>)(\s*<!--(?:seg|rpgda-seg):[^>]*-->)?\s*<\/div>/gi;
        var out = mes.replace(re, function (m, img, seg) {
            var img2 = String(img).replace(/^(<image[^>]*>\s*\n?)(regex:[^\n]*)/i, '$1<span style="display:none">$2\n</span>');
            return img2 + (seg || '');
        });
        // 宽松兜底：div 样式属性顺序不同（display 不在 style 第一项）时也转
        if (out === mes) {
            out = mes.replace(/<div[^>]*>\s*(<image[^>]*>[\s\S]*?<\/image>)(\s*<!--seg:[^>]*-->)?\s*<\/div>/gi, function (m, img, seg) {
                var img2 = String(img).replace(/^(<image[^>]*>\s*\n?)(regex:[^\n]*)/i, '$1<span style="display:none">$2\n</span>');
                return img2 + (seg || '');
            });
        }
        return out;
    }

    // v2.84：一键迁移当前聊天里所有旧格式（v2.81 div 包裹）消息，保存并重渲染
    function migrateAllOldMessages() {
        try {
            var ctx = getCtx();
            if (!ctx || !Array.isArray(ctx.chat)) { if (window.toastr) toastr.warning('L·Bridge：未取得聊天上下文'); return; }
            var changed = 0, ids = [];
            ctx.chat.forEach(function (m) {
                if (!m || typeof m.mes !== 'string') return;
                var migrated = migrateLegacyDivBlocks(m.mes);
                if (migrated !== m.mes) { m.mes = migrated; changed++; ids.push(m.id); }
            });
            if (!changed) { if (window.toastr) toastr.info('L·Bridge：没有旧格式（v2.81 div包裹）图块，无需迁移'); return; }
            // 保存
            if (typeof window.saveChatConditional === 'function') { try { window.saveChatConditional(); } catch (e1) {} }
            if (ctx && typeof ctx.saveChat === 'function') { try { ctx.saveChat(); } catch (e2) {} }
            // 重渲染被改动的消息
            var es = getEventSource(), et = getEventTypes();
            if (es && et) {
                ids.forEach(function (mid) {
                    try { es.emit(et.MESSAGE_EDITED, mid); } catch (e3) {}
                });
                try { es.emit(et.CHAT_CHANGED, ctx.chat.length); } catch (e4) {}
            }
            if (window.toastr) toastr.success('L·Bridge：已迁移 ' + changed + ' 条旧消息图块，正在刷新按钮…');
            logInfo('迁移旧消息', '已迁移 ' + changed + ' 条（' + ids.join(',') + '）');
            setTimeout(function () { try { triggerZhiHuiJiRender({ batching: true }); } catch (e5) { logErr('迁移后渲染', e5); } }, 900);
        } catch (e) { logErr('迁移旧消息', e); if (window.toastr) toastr.error('L·Bridge：迁移失败 ' + e.message); }
    }


    function tryInsertBlocks(content, segs, alignedBlocks) {
        // 构建 原文→归一化文本 字符映射（换行/多空格归一成单空格）
        // 定位文本与切分文本同源（剥掉 VoiceTag/标签/imgthink 等，等长空格替换，位置不变）。
        // 注意：loc 只用于定位（与 content 等长，位置一一对应），插入必须基于原始 content（保留已有图块）
        var loc = stripExtras(content);
        // 去空白定位（v2.50）：段文本由 splitSentences+chunkUnits 合并生成，句子间会带 join 空格；
        // 而旧图块被剥成 ' '/\r\n 残渣可能落在句号前/后，导致"段文本与定位文本的空格模式不一致"→ 整段失配 → 图块错位/堆末尾。
        // 两侧都去掉全部空白再匹配，空格差异彻底不影响；mapD 记录"去空白后每个字符 → 原 loc 位置"，插入点仍落在段尾字符之后（不拆句）。
        var cDense = loc.replace(/\s+/g, '');
        var mapD = [];
        for (var ci = 0; ci < loc.length; ci++) {
            if (!/\s/.test(loc[ci])) mapD.push(ci);
        }
        var points = [];
        var inserted = 0;
        var failed = [];
        var searchPos = 0;
        for (var i = 0; i < segs.length; i++) {
            var img = chatuNormalizeBlock(alignedBlocks[i] || '', segs[i]);
            if (!img) continue;
            var sDense = String(segs[i]).replace(/\s+/g, '');
            if (!sDense) { failed.push(i); continue; }
            var ni = cDense.indexOf(sDense, searchPos); // 顺序匹配：从上一段落结束位置往后找
            var usedLen = sDense.length;
            if (ni === -1) {
                // 整段匹配失败：截取【末尾】20字重试（避开跨段合并/注释残渣导致的不一致；
                // 用句尾而非句首，保证兜底命中时图块也在句子末尾，不会把句子拆开）
                var short = sDense.slice(Math.max(0, sDense.length - 20));
                if (short.length >= 8) {
                    var ni2 = cDense.indexOf(short, searchPos);
                    if (ni2 !== -1) { ni = ni2; usedLen = short.length; }
                }
            }
            if (ni === -1) { failed.push(i); continue; }
            searchPos = ni + usedLen;
            // v2.80 修复：原来 endIdx = mapD[ni+usedLen] 取的是"段尾后第一个非空白字符"的位置；
            // 当段尾后面紧跟着被剥成空格的锚点/HTML注释（如 <!--配图-->、草稿注释）时，会把插入点
            // 错误推到【下一段开头】（块插到下一段前，VN 行级绑定错位）。改为取段文本最后一个字符
            // 的位置 +1（= 段尾之后、锚点之前），块始终贴在本段末尾。
            var endIdx = mapD[ni + usedLen - 1] + 1;
            if (endIdx === undefined) endIdx = content.length;
            // v2.83：regex 行 span 隐藏 + image### 裸放（见 wrapImageBlock 注释）
            points.push({ endIdx: safeInsertPoint(content, endIdx), img: wrapImageBlock(img, '<!--rpgda-seg:' + i + ':' + segFingerprint(segs[i]) + '-->') });
            inserted++;
        }
        // 从后往前执行插入，避免索引位移
        points.sort(function (a, b) { return b.endIdx - a.endIdx; });
        var newContent = content;
        points.forEach(function (pt) {
            newContent = newContent.slice(0, pt.endIdx) + pt.img + newContent.slice(pt.endIdx);
        });
        if (failed.length) {
            var tail = [];
            failed.forEach(function (fi) { if (alignedBlocks[fi]) tail.push(wrapImageBlock(alignedBlocks[fi], '<!--rpgda-seg:' + fi + ':' + segFingerprint(segs[fi]) + '-->')); });
            if (tail.length) newContent += '\n' + tail.join('\n');
        }
        for (var j = segs.length; j < alignedBlocks.length; j++) {
            if (alignedBlocks[j]) { newContent += '\n' + wrapImageBlock(alignedBlocks[j], '<!--rpgda-seg:' + j + ':' + segFingerprint(segs[j]) + '-->'); inserted++; }
        }
        return { newContent: newContent, inserted: inserted, failed: failed };
    }

    // 增量插入：不剥已有图块，只把缺失段（alignedBlocks 中非空）插到对应位置；已有图块原样保留
    function insertBlocksIncremental(mes, alignedBlocks, segs) {
        if (!alignedBlocks.length) return mes;
        segs = segs || extractParagraphs(mes);
        var out = mes;
        var prefix = '', content = out, suffix = '';
        var hasContent = /<content[^>]*>/i.test(out);
        if (hasContent) {
            var lastOpen = null, cRe = /<content[^>]*>/gi, cm;
            while ((cm = cRe.exec(out)) !== null) lastOpen = cm;
            var lastClose = null, cRe2 = /<\/content>/gi, cm2;
            while ((cm2 = cRe2.exec(out)) !== null) lastClose = cm2;
            if (lastOpen && lastClose && lastClose.index > lastOpen.index) {
                prefix = out.slice(0, lastOpen.index);
                content = out.slice(lastOpen.index, lastClose.index);
                suffix = out.slice(lastClose.index);
            }
        }
        var r1 = tryInsertBlocks(content, segs, alignedBlocks);
        logInfo('插入图片（增量）', '成功定位插入 ' + r1.inserted + ' 张' + (r1.failed.length ? '，定位失败追加末尾 ' + r1.failed.length + ' 张' : '') + '（已有图块保留不动）');
        return prefix + r1.newContent + suffix;
    }

    // 修复 AI 畸形的 <content> 结构（AI 可能早写/多写 </content>、把规则复述/大纲贴进 content 区域、
    // 或在 thinking 里误写标签）。目标：消息内只保留【最后一对】<content>…</content>，孤立标签删除，
    // 空壳"正文"与括号式规则残留剥离，让 VN 等下游插件（取第一对标签）能拿到完整正文。
    function repairContentStructure(mes) {
        var out = String(mes || '');
        if (!/<content/i.test(out) && !/<\/content>/i.test(out)) return out;
        var lastOpen = null, cRe = /<content[^>]*>/gi, cm;
        while ((cm = cRe.exec(out)) !== null) lastOpen = cm;
        var lastClose = null, cRe2 = /<\/content>/gi, cm2;
        while ((cm2 = cRe2.exec(out)) !== null) lastClose = cm2;
        if (!lastOpen && !lastClose) return out;
        if (!lastOpen) return out.replace(/<\/content>/gi, '');          // 只有孤立闭标签：全删
        if (!lastClose) return out + '</content>';                        // 有开无闭：末尾补闭
        if (lastClose.index < lastOpen.index) return out;                 // 完全错乱：不动
        var start = lastOpen.index;
        var end = lastClose.index + lastClose[0].length;
        var prefix = out.slice(0, start);
        var body = out.slice(start + lastOpen[0].length, lastClose.index);
        var suffix = out.slice(end);
        // 开标签之前（thinking 等）的孤立/假 content 标签全删
        prefix = prefix.replace(/<content[^>]*>/gi, '').replace(/<\/content>/gi, '');
        // body 内多余的闭/开标签删掉（只保留外围一对）
        body = body.replace(/<\/content>/gi, '').replace(/<content[^>]*>/gi, '');
        // 空壳剥离：AI 误写 "<content>正文" 占位后接大量空行
        body = body.replace(/^(?:正文[\s　]{15,})/, '');
        // 括号式规则残留剥离：body 开头是中文括号单行（10-80字，如"（橙光式短段落，段间空行）"）
        body = body.replace(/^（[^）\n]{10,80}）\s*\n+/, '');
        // 压缩连续空行 + 首尾清理
        body = body.replace(/\n{3,}/g, '\n\n').replace(/^\s*\n+/, '').replace(/\s+$/, '');
        var repaired = prefix + '<content>' + body + '</content>' + suffix;
        if (repaired !== out) logInfo('结构修复', 'content 标签配平/清理完成（' + (out.length - repaired.length) + ' 字符）');
        return repaired;
    }

    function insertBlocksIntoMessage(mes, alignedBlocks, segs) {
        if (!alignedBlocks.length) return mes;
        segs = segs || extractParagraphs(mes);
        var out = mes
            .replace(/<div[^>]*>\s*<image[^>]*>[\s\S]*?<\/image>\s*<!--\s*(?:seg|rpgda-seg):\s*\d+(?::[^>]*?)?\s*-->\s*<\/div>/gi, ' ') // v2.81 div 包裹的带锚图块
            .replace(/<div[^>]*>\s*<image[^>]*>[\s\S]*?<\/image>\s*<\/div>/gi, ' ') // v2.81 div 包裹的无锚旧块
            .replace(/<image[^>]*>[\s\S]*?<\/image>\s*<!--\s*(?:seg|rpgda-seg):\s*\d+(?::[^>]*?)?\s*-->/gi, ' ') // 带锚的图块连同锚剥成空格（与 cleanBody 一致：防段落合并 + 切分/定位文本同源）
            .replace(/<image[^>]*>[\s\S]*?<\/image>/gi, ' '); // 无锚旧块兜底
        var hasContent = /<content[^>]*>/i.test(out);
        var prefix = '', content = out, suffix = '';
        if (hasContent) {
            // 取【最后一个】<content> 对（与 cleanBody 一致）：
            // AI 的思考文本里可能误写 '<content>正文' 字样，第一个匹配往往是假的
            var lastOpen = null, cRe = /<content[^>]*>/gi, cm;
            while ((cm = cRe.exec(out)) !== null) lastOpen = cm;
            var lastClose = null, cRe2 = /<\/content>/gi, cm2;
            while ((cm2 = cRe2.exec(out)) !== null) lastClose = cm2;
            if (lastOpen && lastClose && lastClose.index > lastOpen.index) {
                var start = lastOpen.index + lastOpen[0].length; // content 内部不含开标签
                var end = lastClose.index;
                prefix = out.slice(0, start);
                content = out.slice(start, end);
                suffix = out.slice(end);
            }
        }
        // 第一轮：用原始 content 定位（正文原样保留）
        var r1 = tryInsertBlocks(content, segs, alignedBlocks);
        var usedClean = false;
        if (r1.failed.length) {
            // 定位失败说明 content 与切分文本不一致（残留 imgthink/HTML标签/其他标记）。
            // 第二轮：content 也走 cleanBody（与切分同一处理链），文本必然一致，定位100%命中
            var cleaned = cleanBody(content);
            if (cleaned.trim() && cleaned !== content) {
                var r2 = tryInsertBlocks(cleaned, segs, alignedBlocks);
                if (r2.failed.length < r1.failed.length) { r1 = r2; usedClean = true; }
            }
        }
        logInfo('插入图片', (usedClean ? '[清理正文后] ' : '') + '成功定位插入 ' + r1.inserted + ' 张' + (r1.failed.length ? '，定位失败追加末尾 ' + r1.failed.length + ' 张（段落数 ' + segs.length + '）' : '（段落数 ' + segs.length + '）'));
        return prefix + r1.newContent + suffix;
    }

    var stream = null;
    var inflightCount = 0;
    // ========== 分片批量配图：可暂停/继续/取消，缺失段自动回收 ==========
    var job = { active: false, paused: false, mes: null, segs: [], nextIndex: 0, blocks: [], titles: [], ctxBlock: '', _resolveRun: null };
    function pauseBatchJob() { if (job && job.active && !job.paused) { job.paused = true; if (window.toastr) toastr.info('已暂停：当前片段完成后停止，已生成的图已保留'); } }
    function resumeBatchJob() {
        if (!job || !job.active || !job.paused) return;
        job.paused = false;
        if (window.toastr) toastr.success('继续配图…');
        runJobPieces();
    }
    function cancelBatchJob() {
        if (!job || !job.active) return;
        job.active = false;
        job.paused = false;
        // 强制结束 runJobPieces 的挂起 promise，让 processLastMessage 的 finally 释放 doneLock
        if (job._resolveRun) { var _r = job._resolveRun; job._resolveRun = null; _r(); }
        var got = job.blocks ? job.blocks.filter(Boolean).length : 0;
        if (got > 0 && job.mes) {
            var aligned = job.segs.map(function (_, i) { return job.blocks[i] || ''; });
            // v2.94 修复：与 finishBatchJob 相同——取消时若为增量模式也必须走增量回填，防止剥掉已有图块
            job.mes.mes = (job.existing && Object.keys(job.existing).length)
                ? insertBlocksIncremental(job.mes.mes, aligned, job.segs)
                : insertBlocksIntoMessage(job.mes.mes, aligned, job.segs);
            finishAndRender(job.mes, got);
        }
        hideProgress();
        if (window.toastr) toastr.info('已取消配图（已保留已生成的 ' + got + ' 张）');
    }
    function pauseInsert() {
        var got = job.blocks.filter(Boolean).length;
        if (got > 0 && job.mes) {
            var aligned = job.segs.map(function (_, i) { return job.blocks[i] || ''; });
            job.mes.mes = (job.existing && Object.keys(job.existing).length)
                ? insertBlocksIncremental(job.mes.mes, aligned, job.segs)
                : insertBlocksIntoMessage(job.mes.mes, aligned, job.segs);
            finishAndRender(job.mes, got);
        }
        showProgress('已暂停：已生成并插入 ' + got + ' 张，点「▶ 继续」接着配后面的', got, job.segs.length);
    }
    function logReqStats(label) {
        try {
            if (!reqStats || !reqStats.list || !reqStats.list.length) return;
            var n = reqStats.list.length;
            var ok = 0, blk = 0, ret = 0, pt = 0, ct = 0, failN = 0;
            reqStats.list.forEach(function (s) {
                if (s.ok) { ok++; blk += s.blocks || 0; } else failN++;
                ret += s.retries || 0;
                pt += s.promptTok || 0; ct += s.compTok || 0;
            });
            var secs = Math.max(1, Math.round((Date.now() - (reqStats.startAt || Date.now())) / 1000));
            logInfo(label || '请求统计', '消息「' + (reqStats.msgName || reqStats.msgId || '-') + '」本次共 ' + n + ' 次请求：成功 ' + ok + '，失败 ' + failN + '，成功图块 ' + blk + ' 张，自动重试 ' + ret + ' 次，耗时 ' + secs + ' 秒');
            logInfo(label || '请求统计', 'Token 统计：输入 ' + pt + '，输出 ' + ct + '，合计 ' + (pt + ct) + '');
            // v2.95：统计只在最后一条消息完整生成并配图完成后（done=true）才写入 UI；
            // 任务进行中只记日志、不刷新统计数字（避免"隔一会看就不一样"）。
            if (reqStats.done === false) return;
            var el = document.getElementById('rpgda-reqstat');
            if (el) {
                el.innerHTML = '本次（' + (reqStats.msgName || reqStats.msgId || '-') + '）：请求 <b>' + n + '</b> 次 · 成功 <b>' + ok + '</b> / 失败 <b>' + failN + '</b> · 图块 <b>' + blk + '</b> 张 · 重试 <b>' + ret + '</b> 次 · Token 输入 <b>' + pt + '</b> / 输出 <b>' + ct + '</b> · ' + secs + ' 秒';
            }
        } catch (e) {}
    }
    async function finishBatchJob() {
        // 缺失回收：超长截断导致的缺失段，逐个单独补（单段输出量小，不会再次截断）
        var miss = [];
        job.segs.forEach(function (s, i) { if (!job.blocks[i] && !(job.existing && job.existing[i])) miss.push({ text: s, idx: i }); });
        if (miss.length) {
            logInfo('缺失回收', '前序请求未成功的画面 ' + miss.length + ' 个，按片分批补');
            var bsM = Math.max(1, parseInt(settings.batchSize, 10) || 4);
            for (var mi2 = 0; mi2 < miss.length; mi2 += bsM) {
                var sliceM = miss.slice(mi2, mi2 + bsM);
                showProgress('回收缺失段 第 ' + Math.min(mi2 + sliceM.length, miss.length) + '/' + miss.length, Math.min(mi2 + sliceM.length, miss.length), miss.length);
                try {
                    // v2.94：缺失回收含种子片（idx 0）时用完整上下文（种子片定义全局服装/场景一致性，
                    // 不能只参考"后面已成功片"的摘要，否则顺序倒置、补出的种子片质量最差）
                    // v2.96：完整上下文也改为「静态设定块+前文」注入（job.ctxBlock 已在 startBatchJob 按前文构建）
                    var ctxR = sliceM.some(function (m) { return m.idx === 0; }) ? job.ctxBlock : buildLightContext(job.titles, job.starts[sliceM[0].idx]);
                    var bm = await callImgAPI(sliceM.map(function (m) { return job.segs[m.idx]; }), ctxR, sliceM.map(function (m) { return job.intents[m.idx]; }));
                    if (bm && bm.length) {
                        for (var jm = 0; jm < bm.length && jm < sliceM.length; jm++) {
                            if (bm[jm]) { job.blocks[sliceM[jm].idx] = bm[jm]; pushTitle(job.titles, bm[jm]); }
                        }
                    }
                } catch (e) { logErr('缺失段回收', e); }
            }
        }
        var got = job.blocks.filter(Boolean).length;
        if (got > 0 && job.mes) {
            var aligned = job.segs.map(function (_, i) { return job.blocks[i] || ''; });
            // v2.94 修复：增量模式（job.existing 非空）完成/回收后回填必须走 insertBlocksIncremental
            // （保留已有图块、只插缺失段）；旧代码无条件 insertBlocksIntoMessage，其第一步会剥掉消息里
            // 全部旧图块，而 aligned 只含本次新生成段 → 增量补图后旧图全部丢失。
            job.mes.mes = (job.existing && Object.keys(job.existing).length)
                ? insertBlocksIncremental(job.mes.mes, aligned, job.segs)
                : insertBlocksIntoMessage(job.mes.mes, aligned, job.segs);
            finishAndRender(job.mes, got);
        } else {
            if (window.toastr) toastr.error('L·Bridge：所有画面都未生成成功，请查看错误日志');
        }
        hideProgress();
        reqStats.done = true;
        logReqStats('配图完成统计');
        job.active = false;
    }
    // 并发泵：非流式/流式共用「并发」参数（最多同时几个片请求），顺序按索引存、不乱，
    // 暂停时在飞请求完成后停止派发新片；继续时从断点接着跑
    function runJobPieces() {
        return new Promise(function (resolve) {
            job._resolveRun = resolve;
            if (!job.active) { job._resolveRun = null; resolve(); return; }
            var bs = Math.max(1, parseInt(settings.batchSize, 10) || 4);
            var max = Math.max(1, parseInt(settings.concurrency, 10) || 2);
            var inflight = 0;
            function pump() {
                while (inflight < max && job.active && !job.paused && job.nextIndex < job.segs.length) {
                    // 增量模式：跳过已有锚点的段（已配过图，不重新请求）
                    while (job.nextIndex < job.segs.length && job.existing && job.existing[job.nextIndex]) job.nextIndex++;
                    if (job.nextIndex >= job.segs.length) break;
                    var start = job.nextIndex;
                    // 种子片：任务刚开始（start===0）时第一批先只发 1 片，
                    // 让「下一片注入上一片」的记忆链从第 1 片就成立，后续所有片都有前序画面可参考（服装/场景向种子片看齐）
                    var sliceAll = job.segs.slice(start, start + (start === 0 ? 1 : bs));
                    job.nextIndex += sliceAll.length;
                    // 片内再过滤已有段，保留原始索引
                    var idxs = [];
                    sliceAll.forEach(function (_, k) { if (!(job.existing && job.existing[start + k])) idxs.push(start + k); });
                    if (!idxs.length) continue;
                    inflight++;
                    (function (idList) {
                        limited(async function () {
                            try {
                                var ctxB = (job.titles && job.titles.length) ? buildLightContext(job.titles, job.starts[start]) : job.ctxBlock;
                                var blocks = await callImgAPI(idList.map(function (ix) { return job.segs[ix]; }), ctxB, idList.map(function (ix) { return job.intents[ix]; }));
                                if (blocks && blocks.length) {
                                    for (var i = 0; i < blocks.length && i < idList.length; i++) {
                                        if (blocks[i]) {
                                            job.blocks[idList[i]] = blocks[i];
                                            pushTitle(job.titles, blocks[i]);
                                        }
                                    }
                                }
                            } catch (e) {
                                logErr('分片配图', e);
                                // v2.94：种子片（idx 0）失败不落进最后回收，立即用完整上下文重试一次
                                // （旧逻辑：种子片失败后继续跑后面的片、最后才回收，一致性链条从第1片就断）
                                if (idList.indexOf(0) !== -1 && job.active) {
                                    try {
                                        logInfo('种子片重试', '种子片失败，立即用完整上下文重试');
                                        var blocksR = await callImgAPI([job.segs[0]], job.ctxBlock, [job.intents[0]]);
                                        if (blocksR && blocksR.length && blocksR[0]) {
                                            job.blocks[0] = blocksR[0];
                                            pushTitle(job.titles, blocksR[0]);
                                            logInfo('种子片重试', '种子片重试成功');
                                        } else {
                                            logInfo('种子片重试', '种子片重试未返回图块，交由缺失回收兜底');
                                        }
                                    } catch (e2) { logErr('种子片重试', e2); }
                                }
                            }
                            inflight--;
                            job.doneCount = (job.doneCount || 0) + 1;
                            // 已取消时不再更新进度条（避免取消后黑框持续）
                            if (job.active) {
                                var okN = job.blocks ? job.blocks.filter(Boolean).length : 0;
                                showProgress('正在生成背景图 已成功 ' + okN + '/' + job.segs.length + ' 张', Math.min(okN, job.segs.length), job.segs.length);
                            }
                            pump();
                        });
                    })(idxs);
                }
                if (inflight === 0) {
                    job._resolveRun = null;
                    if (!job.active) { resolve(); return; }
                    if (job.nextIndex >= job.segs.length) { finishBatchJob().then(resolve); return; }
                    if (job.paused) { pauseInsert(); resolve(); return; }
                }
            }
            pump();
        });
    }
    async function startBatchJob(mes, segs) {
        if (!mes || !segs || !segs.length) return;
        // 当前配图正文全文：注入给图模型，让它看到整场戏，保持服装/场景/状态一致
        gFullText = cleanBody(mes.mes || '');
        // v2.96：提取本条静态设定块（正文 AI 在消息开头写的全程一致画面事实）
        gStaticBlock = extractStaticBlock(mes.mes || '');
        // v2.96：锚点模式从对象数组取每单元的原文 start（前文注入截点）与画面意图；
        // 手动模式（字符串数组）无 start/intent，前文回退全文、意图为空
        var _segObjs = splitSegmentsForMes(mes.mes);
        var _starts = [], _intents = [];
        if (_segObjs && _segObjs.length === segs.length) {
            _segObjs.forEach(function (o, k) {
                _starts.push(typeof o.start === 'number' ? o.start : null);
                _intents.push(o.intent || '');
            });
        } else {
            segs.forEach(function () { _starts.push(null); _intents.push(''); });
        }
        // 重置本次任务统计（请求次数/成功失败/Token）；done=false：消息完整生成并配图完成前不展示统计
        reqStats = { list: [], msgId: mes.id, msgName: String(mes.name || ''), startAt: Date.now(), done: false };
        // 增量模式：解析消息里已有图块的锚点，只补缺失段（已有段跳过请求、插入时保留）
        var _anch = (settings.incremental !== false) ? parseSegAnchors(mes.mes) : null;
        var _hasAnchor = _anch && Object.keys(_anch).length > 0;
        var _anchMap = null;
        if (_hasAnchor && segs) _anchMap = computeExistingMap(segs, _anch);
        if (settings.incremental !== false && !_hasAnchor && /<image[^>]*>[\s\S]*?<\/image>/i.test(mes.mes)) {
            logInfo('自动配图', '消息已含图块但无锚点（旧版数据），按全量重配处理');
        }
        job = { active: true, paused: false, mes: mes, segs: segs.slice(), starts: _starts, intents: _intents, nextIndex: 0, blocks: new Array(segs.length), titles: [], ctxBlock: buildFullContext(_starts[0]), existing: _anchMap };
        showProgress('正在为 ' + segs.length + ' 个画面生成背景图', 0, segs.length);
        await runJobPieces();
    }

    async function limited(fn) {
        var max = Math.max(1, parseInt(settings.concurrency, 10) || 2);
        while (inflightCount >= max) await sleep(120);
        inflightCount++;
        try { return await fn(); } finally { inflightCount--; }
    }

    function onMessageUpdated(mesId) {
        if (!settings.enabled || !settings.autoRun || !settings.streamMode) return;
        if (job.active) return; // job 在跑时流式不启动（互斥，避免双跑）
        if (stream && stream.aborted) return; // 用户已中止流式配图，不再响应更新事件（避免进度条持续显示）
        if (mesId && typeof mesId === 'object') mesId = mesId.id; // 兼容事件误传消息对象
        logInfo('流式监听', 'MESSAGE_UPDATED 触发 mesId=' + mesId + '（流式配图进行中）');
        try {
            var ctx = getCtx();
            if (!ctx || !Array.isArray(ctx.chat)) return;
            // v2.89: mesId 无效（undefined/'undefined'/null）直接跳过，
            // 不再"锁定最后一条非用户消息"——页面加载/切聊天时会把历史消息当成新消息触发流式配图
            var idx = -1;
            if (mesId === undefined || mesId === null || mesId === 'undefined') {
                logInfo('流式监听', 'mesId 无效(' + mesId + ')，跳过流式配图（防误配历史消息）');
                return;
            } else {
                idx = ctx.chat.findIndex(function (c) { return String(c.id) === String(mesId); });
                if (idx === -1) {
                    for (var fi = ctx.chat.length - 1; fi >= 0; fi--) {
                        if (!ctx.chat[fi].is_user) { idx = fi; logInfo('自动配图', 'mesId 未匹配(' + mesId + ')，回退到最后一条AI消息 id=' + ctx.chat[fi].id); break; }
                    }
                    if (idx === -1) return;
                }
            }
            var mes = ctx.chat[idx];
            if (isSkippableMessage(mes)) { logInfo('流式监听', '锁定消息被跳过（系统/欢迎消息）id=' + String(mes && mes.id) + ' name=' + String(mes && mes.name || '')); return; }
            // 当前配图正文全文：流式生成中随内容增长刷新，让图模型看到完整剧情，保持服装/场景/状态一致
            gFullText = cleanBody(mes.mes || '');
            // v2.96：流式同样提取静态设定块（本条全程一致的画面事实）
            gStaticBlock = extractStaticBlock(mes.mes || '');
            // 已含图块（如插入完成后触发的 MESSAGE_UPDATED）→ 跳过，避免重复配图循环。
            // 检测必须匹配完整闭合标签 <image>...</image>，否则 AI 思考/正文里复述生图规则（含 <image> 字样）会被误判为"已配图"
            if (mes.mes && /<image[^>]*>[\s\S]*?<\/image>/i.test(mes.mes)) { log('消息已含完整图块，跳过流式配图'); return; }
            // stream 键用真实消息 id（mes.id），不再用事件 mesId——避免 undefined 导致 stream 永不重建、跨消息串流
            var _streamKey = (mes && mes.id !== undefined && mes.id !== null) ? String(mes.id) : 'last-ai';
            // 内容指纹：roll（重新生成）后同 id 消息内容会变，检测到变化强制重置 stream，避免复用上一版的 requested/results/titles 导致雷同
            var _contentFp = (mes.mes || '').slice(0, 120) + '|' + (mes.mes || '').length;
            if (!stream || stream.msgId !== _streamKey || stream.contentFp !== _contentFp) {
                if (stream && stream.msgId === _streamKey && stream.contentFp !== _contentFp) {
                    logInfo('流式监听', '检测到同 id 消息内容变化（roll/重新生成），重置流式配图状态，避免复用上一版图块');
                }
                stream = { msgId: _streamKey, contentFp: _contentFp, requested: new Set(), results: new Map(), titles: [], done: 0, pending: [], pendingTimer: null };
                // v2.95：新消息流式配图开始 → 重置统计（done=false，完整生成完才展示）
                reqStats = { list: [], msgId: _streamKey, msgName: String(mes.name || ''), startAt: Date.now(), done: false };
            }
            var paras = splitSegmentsForMes(mes.mes);
            var totalSegs = paras.filter(function (q) { return q.complete; }).length;
            if (totalSegs) showProgress('切分 ' + totalSegs + ' 个画面，按片生成背景图（每片' + (settings.batchSize || 4) + '个单元）', Math.min(stream.done, totalSegs), totalSegs);
            var fullCtx = buildFullContext();
            var first = true;
            // 收集本次事件新增的句子
            var newSegs = [];
            paras.forEach(function (p) {
                if (!p.complete) return;
                if (stream.requested.has(p.text)) return;
                stream.requested.add(p.text);
                newSegs.push({ text: p.text, first: first, intent: p.intent || '' });
                if (first) first = false;
            });
            // 攒片：事件到的新句子先进 pending，攒够 batchSize 立即发；350ms 没攒满也发（防抖），避免一句一请求
            var bs = Math.max(1, parseInt(settings.batchSize, 10) || 4);
            if (!newSegs.length) return;
            newSegs.forEach(function (s) { stream.pending.push(s); });
            function streamFlush() {
                if (!stream || !stream.pending.length || stream.aborted) return;
                var slice = stream.pending.splice(0, bs);
                var ctxBlock = slice[0].first ? fullCtx : buildLightContext(stream.titles);
                limited(async function () {
                    try {
                        var blocks = await callImgAPI(slice.map(function (s) { return s.text; }), ctxBlock, slice.map(function (s) { return s.intent || ''; }));
                        if (blocks && blocks.length) {
                            for (var j = 0; j < blocks.length && j < slice.length; j++) {
                                if (blocks[j]) {
                                    stream.results.set(slice[j].text, blocks[j]);
                                    pushTitle(stream.titles, blocks[j]);
                                }
                            }
                        }
                    } catch (err) { logErr('流式配图（片）', err); console.error('[L·Bridge] 片请求失败', err); }
                    stream.done++;
                    // 已中止时不再更新进度条（避免取消后黑框持续）
                    if (!stream.aborted) {
                        var okS = stream.results ? stream.results.size : 0;
                        showProgress('流式配图 已成功 ' + okS + ' 张', Math.min(okS, totalSegs), totalSegs);
                        if (stream.done >= totalSegs) { logInfo('流式配图', '全部片处理完，共成功 ' + okS + ' 张，等待生成结束插入'); hideProgress(); }
                    }
                });
                if (stream.pending.length >= bs) streamFlush();
            }
            function scheduleFlush() {
                if (stream && stream.aborted) return;
                if (stream.pendingTimer) clearTimeout(stream.pendingTimer);
                stream.pendingTimer = setTimeout(function () { stream.pendingTimer = null; streamFlush(); }, 350);
            }
            if (stream.pending.length >= bs) streamFlush(); else scheduleFlush();
        } catch (e) { logErr('流式监听异常', e); console.error('[L·Bridge] 流式监听异常', e); }
    }

    // 系统/欢迎消息识别：酒馆启动欢迎消息是 is_user=false 的 AI 消息，自动配图必须跳过
    function isSkippableMessage(mes) {
        // 白名单式判断：只有"正常剧情 AI 消息"才不跳过（返回 false = 可配图）。
        // 不依赖任何关键词（"你好/欢迎/系统消息"等在剧情中极其常见，关键词匹配必然误杀）。
        if (!mes) return true;
        if (mes.is_user) return true;
        if (mes.is_system) return true;
        var nm = String(mes.name || '');
        if (!nm || nm === 'SillyTavern' || nm === 'System' || nm === '系统' || nm === '欢迎') return true;
        var t = String(mes.mes || '').trim();
        // 智绘姬交互界面（interactive_ui / 占位符）：系统卡界面，不是剧情
        if (/<interactive_ui[\s\S]*?<\/interactive_ui>/i.test(t) || /<StatusPlaceHolderImpl/i.test(t)) return true;
        // 剧情消息门槛：剥掉 HTML 后至少 100 字实际叙述才配图
        // （欢迎消息、占位消息、一句半句的过短回复达不到；正常剧情回复轻松超过）
        var plain = t.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        if (plain.length < 100) return true;
        // HTML 标签比实际文字还多（纯界面/代码消息，如 GENESIS 世界库列表）：不是剧情
        var tagLen = (t.match(/<[^>]+>/g) || []).join('').length;
        if (tagLen > plain.length) return true;
        return false;
    }

    var doneLock = false; // 完成处理互斥锁：防止事件+轮询同时进入导致双 job 互剥图块
    async function onMessageDone(mesId) {
        if (doneLock) { logInfo('自动配图', '已有完成处理在跑（doneLock 互斥），本次跳过'); return; }
        doneLock = true;
        try {
            // v2.89: mesId 无效（系统/欢迎消息无 id、事件不带 id）时直接跳过，
            // 禁止回退到最后一条非用户消息——否则页面加载/切聊天时会误配历史消息。
            if (mesId === undefined || mesId === null || mesId === 'undefined' || mesId === 'null') {
                logInfo('自动配图', 'mesId 无效(' + mesId + ')，跳过（防误配历史消息）');
                return;
            }
            var ctx = getCtx();
            if (!ctx || !Array.isArray(ctx.chat)) return;
            var idx = ctx.chat.findIndex(function (c) { return String(c.id) === String(mesId); });
            if (idx === -1) {
                // 类型不匹配（数字/字符串）或事件传参不稳 → 回退到最后一条非用户消息
                for (var fi = ctx.chat.length - 1; fi >= 0; fi--) {
                    if (!ctx.chat[fi].is_user) { idx = fi; logInfo('自动配图', 'mesId 类型/取值不匹配(' + mesId + ')，回退到最后一条AI消息 id=' + ctx.chat[fi].id + ' name=' + String(ctx.chat[fi].name || '')); break; }
                }
                if (idx === -1) return;
            }
            var mes = ctx.chat[idx];
            if (isSkippableMessage(mes)) { logInfo('自动配图诊断', '跳过消息 mesId=' + mesId + ' name=' + String(mes && mes.name || '') + ' 长度=' + (mes && mes.mes ? String(mes.mes).length : 0)); if (mes && mes.mes && !mes.is_user) logInfo('自动配图', '跳过系统/欢迎消息（不配图）'); return; }
            if (/<image[^>]*>[\s\S]*?<\/image>/i.test(mes.mes)) {
                if (settings.incremental !== false) {
                    var _anch = parseSegAnchors(mes.mes);
                    if (Object.keys(_anch).length) { logInfo('自动配图', '消息已有图块（增量模式开），将只补缺失段'); }
                    else { log('消息已含图块但无锚点（旧版数据），跳过；如需重配请用手动按钮'); stream = null; return; }
                } else {
                    log('消息已含图块，跳过（增量开关已关）；如需重配请用手动按钮'); stream = null; return;
                }
            }
            if (job.active) { logInfo('自动配图', '已有手动/分片任务(job)在跑，本次自动跳过（避免双跑覆盖进度）'); return; }
            if (stream && stream.msgId && String(stream.msgId) !== String(mesId)) { logInfo('自动配图', '另一条消息的流式配图仍在进行（stream=' + stream.msgId + ' 当前=' + mesId + '），跳过非流式批量（避免双跑打爆图API限流）'); return; }
            if (stream && String(stream.msgId) === String(mesId)) {
                // 先把攒片没发完的整批顺序发掉（生成已结束，不再等防抖）
                if (stream.pending && stream.pending.length) {
                    var _pend = stream.pending;
                    stream.pending = [];
                    if (stream.pendingTimer) { clearTimeout(stream.pendingTimer); stream.pendingTimer = null; }
                    var bsF = Math.max(1, parseInt(settings.batchSize, 10) || 4);
                    for (var pf = 0; pf < _pend.length; pf += bsF) {
                        var sliceF = _pend.slice(pf, pf + bsF);
                        var ctxF = sliceF[0] && sliceF[0].first ? buildFullContext() : buildLightContext(stream.titles);
                        try {
                            var blocksF = await callImgAPI(sliceF.map(function (s) { return s.text; }), ctxF, sliceF.map(function (s) { return s.intent || ''; }));
                            if (blocksF && blocksF.length) {
                                for (var jf = 0; jf < blocksF.length && jf < sliceF.length; jf++) {
                                    if (blocksF[jf]) {
                                        stream.results.set(sliceF[jf].text, blocksF[jf]);
                                        pushTitle(stream.titles, blocksF[jf]);
                                    }
                                }
                            }
                        } catch (err) { logErr('流式收尾flush', err); }
                    }
                    logInfo('流式收尾', 'flush 攒片 ' + _pend.length + ' 个单元');
                }
                while (inflightCount > 0) await sleep(150);
                var paras = splitSegmentsForMes(mes.mes);
                // 收尾补漏：把流式过程中还没请求过的单元收集起来，按每片 batchSize 分片请求（进度按片跳，不是逐段）
                var missing = [];
                paras.forEach(function (p) {
                    if (stream.requested.has(p.text)) return;
                    stream.requested.add(p.text);
                    missing.push({ text: p.text, intent: p.intent || '' });
                });
                var bsT = Math.max(1, parseInt(settings.batchSize, 10) || 4);
                for (var i = 0; i < missing.length; i += bsT) {
                    var sliceT = missing.slice(i, i + bsT);
                    showProgress('收尾补漏 第 ' + Math.min(i + sliceT.length, missing.length) + '/' + missing.length + ' 个单元', Math.min(i + sliceT.length, missing.length), missing.length);
                    try {
                        var blocks2 = await callImgAPI(sliceT.map(function (s) { return s.text; }), buildLightContext(stream.titles), sliceT.map(function (s) { return s.intent; }));
                        if (blocks2 && blocks2.length) {
                            for (var j = 0; j < blocks2.length && j < sliceT.length; j++) {
                                if (blocks2[j]) {
                                    stream.results.set(sliceT[j].text, blocks2[j]);
                                    pushTitle(stream.titles, blocks2[j]);
                                }
                            }
                        }
                    } catch (err) { logErr('流式收尾分片', err); console.error('[L·Bridge] 收尾片失败', err); }
                }
                if (!missing.length) showProgress('正在把图片插入消息', paras.length, paras.length);
                // 缺失回收：失败/截断的单元按片分批补（不再逐单元串行）
                var missing2 = paras.filter(function (pp) { return !stream.results.has(pp.text); });
                if (missing2.length) logInfo('流式缺失回收', '未成功画面 ' + missing2.length + ' 个，按片分批补');
                var bsR = Math.max(1, parseInt(settings.batchSize, 10) || 4);
                for (var mi = 0; mi < missing2.length; mi += bsR) {
                    var sliceR = missing2.slice(mi, mi + bsR);
                    var sliceRTxt = sliceR.map(function (pp) { return pp.text; });
                    var sliceRInt = sliceR.map(function (pp) { return pp.intent || ''; });
                    showProgress('流式缺失回收 第 ' + Math.min(mi + sliceR.length, missing2.length) + '/' + missing2.length, Math.min(mi + sliceR.length, missing2.length), missing2.length);
                    try {
                        var mb = await callImgAPI(sliceRTxt, buildLightContext(stream.titles), sliceRInt);
                        if (mb && mb.length) {
                            for (var jr = 0; jr < mb.length && jr < sliceR.length; jr++) {
                                if (mb[jr]) stream.results.set(sliceR[jr].text, mb[jr]);
                            }
                        }
                    } catch (e) { logErr('流式缺失回收', e); }
                }
                var aligned = paras.map(function (pp) { return stream.results.get(pp.text) || ''; });
                var got = aligned.filter(Boolean).length;
                mes.mes = insertBlocksIntoMessage(mes.mes, aligned, paras.map(function (pp) { return pp.text; }));
                finishAndRender(mes, got);
                hideProgress();
                reqStats.done = true;
                logReqStats('流式配图完成统计');
                stream = null;
                return;
            }
            var segs = splitSegmentsForMes(mes.mes).map(function (p) { return p.text; });
            if (!segs.length) { stream = null; return; }
            if (settings.incremental !== false) {
                var _anch2 = parseSegAnchors(mes.mes);
                var _miss = 0;
                segs.forEach(function (_, i) { if (!_anch2[i]) _miss++; });
                if (!_miss) { logInfo('自动配图', '所有画面均已配图（增量模式），无需补图'); stream = null; return; }
            }
            stream = null;
            await startBatchJob(mes, segs);
        } catch (err) {
            hideProgress();
            logErr('完成处理', err);
            console.error('[L·Bridge] 完成处理失败', err);
            if (window.toastr) toastr.error('L·Bridge 失败：' + err.message);
            stream = null;
        } finally {
            doneLock = false;
        }
    }

    function finishAndRender(mes, gotCount) {
        try {
            // 防"小丑回魂"v2：检查消息是否还存在、且内容是否还是插件处理的那条
            // 重新 roll 时酒馆会复用消息 id，新消息内容已变，此时绝不能用旧文本覆盖
            var ctx0 = getCtx();
            var curMes = null;
            if (ctx0 && Array.isArray(ctx0.chat)) {
                for (var _ci = 0; _ci < ctx0.chat.length; _ci++) {
                    if (ctx0.chat[_ci] && String(ctx0.chat[_ci].id) === String(mes.id)) { curMes = ctx0.chat[_ci]; break; }
                }
            }
            if (!curMes) { logInfo('插入渲染', '消息已被删除（id=' + mes.id + '），跳过恢复/保存（防小丑回魂）'); return; }
            // 内容指纹比对：剥掉图片 tag/锚点后取开头 150 字符，判断当前消息是否还是插件处理的那条
            function _fp(s) { return String(s || '').replace(/<image[^>]*>[\s\S]*?<\/image>/gi, '').replace(/<!--\s*(?:seg|rpgda-seg):[^>]*-->/g, '').replace(/<content[^>]*>|<\/content>/g, '').replace(/\s+/g, ' ').trim().slice(0, 150); }
            var fpCur = _fp(curMes.mes);
            var fpOld = _fp(mes.mes);
            if (fpCur && fpOld && fpCur !== fpOld) {
                logInfo('插入渲染', '消息内容已变化（疑似重新 roll，id=' + mes.id + '），当前指纹=' + fpCur.slice(0, 50) + '... 旧指纹=' + fpOld.slice(0, 50) + '...，跳过覆盖（防小丑回魂v2）');
                return;
            }
            mes.mes = repairContentStructure(mes.mes); // AI 畸形 content 结构修复（VN 等下游才能取到完整正文）
            var ctx = getCtx();
            // 1) 直接改写 ctx.chat 内存态（保证刷新前就可见）
            if (ctx && Array.isArray(ctx.chat)) {
                for (var ci = 0; ci < ctx.chat.length; ci++) {
                    if (ctx.chat[ci] && ctx.chat[ci].id === mes.id) { ctx.chat[ci].mes = mes.mes; break; }
                }
            }
            // 2) 触发事件强制重绘（MESSAGE_UPDATED 会触发本插件流式监听，但 onMessageUpdated 已有"已含图块则跳过"防循环）
            var es = getEventSource();
            var et = getEventTypes();
            if (es && et) {
                es.emit(et.MESSAGE_EDITED, mes.id);
                es.emit(et.CHARACTER_MESSAGE_RENDERED, mes.id);
                es.emit(et.MESSAGE_UPDATED, mes.id);
            }
            // 3) 酒馆官方 setChatMessage（能真正重渲染+保存，签名：(mesId, mes对象)）
            if (typeof window.setChatMessage === 'function') { try { window.setChatMessage(mes.id, mes); } catch (e4) { logErr('setChatMessage', e4); } }
            // 4) 多路保存 fallback
            if (typeof window.saveChatConditional === 'function') { try { window.saveChatConditional(); } catch (e3) {} }
            if (ctx && typeof ctx.saveChat === 'function') { try { ctx.saveChat(); } catch (e2) {} }
            // 5) v2.96.4: 把新插入的图块文本注入消息 DOM（隐藏占位）——智绘姬扫描的是 .mes_text 的文本，
            //    若酒馆因故未重绘 DOM（表现为"配完tag还要刷新/滚动才出按钮"），占位让智绘姬立刻扫到新块。
            //    仅在 DOM 文本里还看不到任何图块时注入，避免重复。
            try {
                if (gotCount > 0 && mes && mes.mes) {
                    var _mesEl1 = document.querySelector('.mes[mesid="' + mes.id + '"]');
                    if (_mesEl1) {
                        var _mt1 = _mesEl1.querySelector('.mes_text');
                        if (_mt1 && !_mt1.querySelector('.rpgda-img-ph')) {
                            var _curTxt = _mt1.textContent || '';
                            if (!/(image###|<image\b)/i.test(_curTxt)) {
                                var _phText = (mes.mes.match(/<image[^>]*>[\s\S]*?<\/image>/gi) || []).join('\n')
                                    || (mes.mes.match(/image###[\s\S]*?###/g) || []).join('\n');
                                if (_phText) {
                                    var _ph = document.createElement('div');
                                    _ph.className = 'rpgda-img-ph';
                                    _ph.setAttribute('data-rpgda-placeholder', '1');
                                    _ph.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;font-size:0;';
                                    _ph.textContent = _phText;
                                    _mt1.appendChild(_ph);
                                    try { _mt1.dispatchEvent(new Event('DOMSubtreeModified', { bubbles: true })); } catch (e6) {}
                                    logInfo('自动渲染', '已向消息 DOM 注入图块占位（' + gotCount + ' 张），智绘姬可直接扫描');
                                }
                            }
                        }
                    }
                }
            } catch (e7) {}
        } catch (e) { logErr('插入渲染', e); }
        // 校验：统计消息里实际的 image 块数，与 got 比对（诊断"说插入N张但正文看不到"）
        try {
            var _real = (mes && mes.mes ? (mes.mes.match(/<image[^>]*>[\s\S]*?<\/image>/gi) || []).length : 0);
            if (_real < gotCount) logErr('插入校验', new Error('声称插入 ' + gotCount + ' 张，但消息内实际只有 ' + _real + ' 个图块'));
            else logInfo('插入图片', '校验通过：消息内共 ' + _real + ' 个图块');
        } catch (e5) {}
        if (gotCount > 0 && window.toastr) toastr.success('L·Bridge：已插入 ' + gotCount + ' 张背景图');
        // 插入后自动触发智绘姬渲染（不用刷新/不用手动点按钮）。触发智绘姬扫描是异步的，
        // 这里延迟一下确保消息 DOM 已更新；只触发一次，避免事件循环反复触发。
        try {
            if (settings.autoRender !== false && gotCount > 0 && typeof triggerZhiHuiJiRender === 'function') {
                logInfo('自动渲染', '插入完成，延迟触发智绘姬渲染（' + gotCount + ' 张）');
                // v2.89: 智绘姬只扫描"可见"消息（isElementVisible 视口判断）——先把目标消息滚进视口，
                // 否则按钮不自动生成（表现为"要刷新/滚动才出按钮"）。
                try {
                    var _mesEl0 = document.querySelector('.mes[mesid="' + mes.id + '"]');
                    if (_mesEl0 && _mesEl0.scrollIntoView) { try { _mesEl0.scrollIntoView({ block: 'nearest', behavior: 'instant' }); } catch (e7) { try { _mesEl0.scrollIntoView(); } catch (e8) {} } }
                } catch (e9) {}
                setTimeout(function () { try { triggerZhiHuiJiRender({ batching: true }); } catch (er) { logErr('自动渲染', er); } }, 600);
                // v2.89: 渲染兜底——若消息里迟迟没出现智绘姬按钮（首次触发可能被智绘姬的防抖/可见性逻辑吞掉），
                // 每 4s 补触发一次，最多 10 轮；检测到按钮即停。v2.95 增加：每轮滚动+派发 scroll 事件，
                // 并额外触发一次"先离屏再回视口"的滚动（模拟用户滚动，智绘姬的视口扫描才被唤醒）。
                (function (_mid) {
                    var _attempt = 0;
                    var _t = setInterval(function () {
                        try {
                            var _has = false;
                            var _mesEl = document.querySelector('.mes[mesid="' + _mid + '"]');
                            if (_mesEl && _mesEl.querySelector('.st-chatu8-image-button, .image-tag-button')) _has = true;
                            _attempt++;
                            if (_has || _attempt >= 10) { clearInterval(_t); return; }
                            logInfo('自动渲染', '第 ' + _attempt + ' 轮未检测到按钮，补触发智绘姬渲染');
                            // 补触发前再次滚进视口（先远离再回来，模拟真实用户滚动）
                            try {
                                var _mel = document.querySelector('.mes[mesid="' + _mid + '"]');
                                if (_mel) {
                                    var _scr = document.querySelector('.mes, .chat, .scrollable, #chat, .mes_text') || null;
                                    if (_scr && _scr.scrollTop !== undefined) { try { _scr.scrollTop = Math.max(0, _scr.scrollTop - 260); } catch (e12) {} }
                                    if (_mel.scrollIntoView) { try { _mel.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch (e10) { try { _mel.scrollIntoView(); } catch (e11) {} } }
                                }
                            } catch (e13) {}
                            try { window.dispatchEvent(new Event('scroll')); } catch (e14) {}
                            try { document.dispatchEvent(new Event('scroll')); } catch (e15) {}
                            triggerZhiHuiJiRender({ batching: true });
                        } catch (e) { clearInterval(_t); }
                    }, 4000);
                })(mes.id);
            }
        } catch (e6) { logErr('自动渲染', e6); }
    }

        // ========== 智绘姬渲染触发器（按钮/插入后自动触发共用） ==========
        // 原理：①打开智绘姬的「自动点击窗口」(window.zidongdianji)——它内部 findAndReplaceInElement
        // 发现新按钮后会自动批量触发；②模拟 iframe 增删「叫醒」它的 MutationObserver →
        // debouncedProcessVisible → 重新扫描可见消息里的 image###…### tag 生成按钮；
        // ③分批兜底直接点按钮（每批 batchSize 张、批间停顿，防 429），前面的优先生成。
        function triggerZhiHuiJiRender(opts) {
            opts = opts || {};
            var batchSize = Math.max(1, parseInt(opts.batchSize || settings.batchSize, 10) || 4);
            var batchGap = Math.max(1000, parseInt(opts.batchGap || 4000, 10) || 4000); // 批间停顿（ms），防429
            var doBatching = opts.batching !== false; // 默认分批；false=一把梭（旧行为）
            var clicked = 0, skipped = 0;
            // ① 打开自动点击窗口（智绘姬 1.8s 后自动关）
            try { window.zidongdianji = true; window.zidongdianjiStartTime = Date.now(); } catch (e1) {}
            // ② 模拟 iframe 增删触发智绘姬重扫
            var _tmpIframe = null;
            try {
                _tmpIframe = document.createElement('iframe');
                _tmpIframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;';
                document.body.appendChild(_tmpIframe);
            } catch (e3) {}
            // v2.89: 智绘姬只扫描"可见"消息——若按钮没生成，一键渲染就点不到。
            // 先把含未处理 image### 的消息逐条滚进视口 + 触发重扫，让按钮先全部生成。
            function scrollWarmup(cb) {
                var targets = [];
                try {
                    var _mesAll = document.querySelectorAll('.mes');
                    for (var _a = 0; _a < _mesAll.length; _a++) {
                        try {
                            var _me = _mesAll[_a];
                            if (_me.querySelector('.st-chatu8-image-button, .image-tag-button')) continue; // 已有按钮
                            var _txt = _me.querySelector('.mes_text');
                            if (!_txt) continue;
                            if (/image###/i.test(_txt.textContent || '')) targets.push(_me); // 含待渲染 tag
                            // v2.96.4: 插件插入的是 <image>…</image> 完整块，同样需要滚进视口让智绘姬扫描
                            else if (/<image\b/i.test(_txt.textContent || '')) targets.push(_me);
                        } catch (e) {}
                    }
                } catch (e) {}
                if (!targets.length) { if (cb) cb(); return; }
                var _i = 0;
                (function _next() {
                    var _me = targets[_i];
                    if (_me && _me.scrollIntoView) {
                        try { _me.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch (e1) { try { _me.scrollIntoView(); } catch (e2) {} }
                    }
                    var _tf = null;
                    try { _tf = document.createElement('iframe'); _tf.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;'; document.body.appendChild(_tf); } catch (e3) {}
                    setTimeout(function () { try { if (_tf && _tf.parentNode) _tf.parentNode.removeChild(_tf); } catch (e4) {} }, 250);
                    _i++;
                    if (_i < targets.length) setTimeout(_next, 450);
                    else if (cb) cb();
                })();
            }
            function collectButtons() {
                var list = [];
                try {
                    var roots = [document];
                    var fe = window.frameElement;
                    var scope = (fe && fe.contentDocument) ? fe.contentDocument : null;
                    if (scope) roots.push(scope);
                    roots.forEach(function (root) {
                        if (!root) return;
                        var btns = root.querySelectorAll('.st-chatu8-image-button, .image-tag-button');
                        btns.forEach(function (b) {
                            if (!b || !b.dataset) return;
                            if (b.dataset.autoClickHandled === 'true' || b.dataset.loading === 'true') return;
                            if (b.style && b.style.display === 'none') return;
                            var reqId = b.dataset.requestId;
                            var span = reqId ? b.closest('.mes_text') : null;
                            if (span) {
                                var sp = span.querySelector('span[data-request-id="' + CSS.escape(reqId) + '"]');
                                if (sp && sp.querySelector('img, video, .st-chatu8-video-fallback')) return;
                            }
                            list.push(b);
                        });
                    });
                } catch (e) { logErr('智绘姬渲染', e); }
                return list;
            }
            function clickOne(b) {
                // 已被点击/处理中/已有图的一律跳过（两轮 fireRound 并发推进时防重复点击）
                if (!b || !b.dataset) { skipped++; return false; }
                if (b.dataset.autoClickHandled === 'true' || b.dataset.loading === 'true') { skipped++; return false; }
                if (b.style && b.style.display === 'none') { skipped++; return false; }
                try { b.dataset.autoClickHandled = 'true'; b.click(); clicked++; return true; }
                catch (e2) { skipped++; return false; }
            }
            function fireRound(cb) {
                var list = collectButtons();
                if (!doBatching || list.length <= batchSize) {
                    list.forEach(function (b) { if (clickOne(b)) {} });
                    if (cb) cb();
                    return;
                }
                // 分批：每批 batchSize 张，批间停顿 batchGap ms（前面的优先，逐批推进防429）
                var i = 0;
                (function nextBatch() {
                    var end = Math.min(i + batchSize, list.length);
                    for (; i < end; i++) clickOne(list[i]);
                    if (i < list.length) setTimeout(nextBatch, batchGap);
                    else if (cb) cb();
                })();
            }
            // v2.89: 先滚动预热（逐条滚动+触发重扫让按钮生成），再统一收集点击
            scrollWarmup(function () {
                // 第一轮：等智绘姬扫描生成按钮后点（800ms）；第二轮收尾（1700ms），顺便清临时 iframe
                setTimeout(function () { fireRound(); }, 800);
                setTimeout(function () {
                    fireRound(function () {
                        if (_tmpIframe && _tmpIframe.parentNode) { try { _tmpIframe.parentNode.removeChild(_tmpIframe); } catch (e4) {} }
                        var msg = '已触发 ' + clicked + ' 个生成按钮' + (skipped ? '（跳过 ' + skipped + ' 个：处理中/已处理/已有图）' : '') + (doBatching ? '（每批 ' + batchSize + ' 张）' : '');
                        if (clicked === 0 && skipped > 0) msg += '。若其他消息按钮未出现，请滚动到该消息或刷新页面后再试';
                        var _stEl = document.getElementById('rpgda-status'); if (_stEl) _stEl.textContent = msg;
                        if (window.toastr) toastr.success(msg);
                        logInfo('一键渲染', msg);
                    });
                }, 1700);
            }); // end scrollWarmup
            var _stEl = document.getElementById('rpgda-status'); if (_stEl) _stEl.textContent = '已开启智绘姬自动点击窗口，正在滚动预热并分批触发生成…';
        }
    var pollTimer = null;
    var lastPollSig = '';
    function pollSig() {
        try {
            var ctx = getCtx();
            if (!ctx || !Array.isArray(ctx.chat) || !ctx.chat.length) return 'none';
            var last = ctx.chat[ctx.chat.length - 1];
            if (last.is_user) return 'u' + last.id + ':' + (last.mes || '').length;
            return 'a' + last.id + ':' + (last.mes || '').length;
        } catch (e) { return 'none'; }
    }
    var pollCurId = null, pollCurLen = -1, pollStable = 0, pollDoneId = null, pollDoneLen = -1;
    // v2.89: 聊天基线——页面加载/切换聊天后，把当前最后一条AI消息记为"已处理"，
    // 历史消息（含上次会话最后一条正文）不再被当成"新消息"触发自动配图（防"进酒馆就自动配图"）。
    var pollChatKey = null;
    function pollChatKeyOf() {
        try { var _c = getCtx(); return String((_c && (_c.chatId !== undefined ? _c.chatId : _c.currentChat)) || ''); } catch (e) { return ''; }
    }
    function pollOnce() {
        if (!settings.enabled || !settings.autoRun) return;
        // 页面检测：主页（无聊天消息元素）时不触发自动配图，避免进酒馆就误配
        if (!document.querySelector('.mes')) return;
        // 聊天基线首次建立/切换：记录当前最后一条AI消息为已处理，本次不触发
        var _ck = pollChatKeyOf();
        if (_ck !== pollChatKey) {
            pollChatKey = _ck;
            var _sig0 = pollSig();
            if (_sig0 && _sig0.indexOf('a') === 0) {
                var _p0 = _sig0.slice(1).split(':');
                pollDoneId = _p0[0] || '';
                pollDoneLen = parseInt(_p0[1], 10) || 0;
            } else { pollDoneId = null; pollDoneLen = -1; }
            pollCurId = null; pollCurLen = -1; pollStable = 0;
            return;
        }
        var sig = pollSig();
        if (!sig || sig.indexOf('a') !== 0) return;
        var parts = sig.slice(1).split(':');
        var id = parts[0], len = parseInt(parts[1], 10) || 0;
        // v2.89: 无效 id（系统/欢迎消息无 id 时 sig 为 'aundefined:xx'）一律不触发配图
        if (!id || id === 'undefined' || id === 'null') {
            if (id === 'undefined' || id === 'null') { pollDoneId = id; pollDoneLen = len; }
            return;
        }
        // roll/重新生成检测：同 id 消息长度变化说明内容被重写，重置轮询状态，避免被 pollDoneId 误判为"已处理"
        if (id === pollDoneId && len !== pollDoneLen) {
            logInfo('自动配图（轮询）', '检测到同 id 消息长度变化（roll/重新生成），重置轮询状态');
            pollDoneId = null; pollCurId = null; pollCurLen = -1; pollStable = 0; pollDoneLen = -1;
        }
        // 已处理过的消息直接短路（避免系统/欢迎消息每轮重复打日志刷屏）
        if (id === pollDoneId) return;
        // 轮询层预过滤：系统/欢迎/主页消息直接标记为已处理，不触发配图
        try {
            var ctx0 = getCtx();
            if (ctx0 && Array.isArray(ctx0.chat)) {
                var preMes = ctx0.chat.find(function (c) { return String(c.id) === String(id); });
                if (preMes && isSkippableMessage(preMes)) {
                    pollDoneId = id; pollCurId = null; pollCurLen = -1; pollStable = 0; pollDoneLen = len;
                    logInfo('自动配图（轮询）', '跳过系统/欢迎消息 mesId=' + id + ' name=' + String(preMes.name || ''));
                    return;
                }
            }
        } catch (e) {}
        // 流式模式：消息长度在变化=正在生成 → 增量调用流式配图（onMessageUpdated 内部有 requested 去重，安全）
        if (settings.streamMode) {
            if (id === pollDoneId) return;
            if (id === pollCurId && len === pollCurLen) return;
            pollCurId = id; pollCurLen = len;
            onMessageUpdated(id);
            return;
        }
        // 非流式模式：连续4次（约10秒）长度不变才视为"生成完"，触发一次
        if (id === pollDoneId) return;
        if (id === pollCurId && len === pollCurLen) pollStable++;
        else { pollCurId = id; pollCurLen = len; pollStable = 0; return; }
        if (pollStable < 4) return;
        pollDoneId = id; pollCurId = null; pollCurLen = -1; pollStable = 0; pollDoneLen = len;
        logInfo('自动配图（轮询）', '检测到新AI消息 mesId=' + id + '（长度已稳定），开始自动配图');
        onMessageDone(id);
    }
    function startPolling() {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(function () {
            try { pollOnce(); } catch (e) {}
        }, 2500);
        log('轮询模式已启动');
    }

    async function processLastMessage() {
        if (job.active) { if (window.toastr) toastr.warning('已有配图任务进行中：请等它完成，或点进度条上的「✕ 取消」后再试'); return; }
        if (doneLock) { if (window.toastr) toastr.warning('已有配图任务处理中（doneLock），请稍候'); return; }
        doneLock = true;
        try {
            var ctx = getCtx();
            if (!ctx || !ctx.chat || !ctx.chat.length) { if (window.toastr) toastr.warning('没有聊天消息'); return; }
            var chat = ctx.chat;
            for (var i = chat.length - 1; i >= 0; i--) {
                if (chat[i].is_user) continue;
                if (isSkippableMessage(chat[i])) { if (window.toastr) toastr.info('跳过系统/欢迎消息（不配图）'); continue; }
                var mes = chat[i];
                try {
                    if (settings.incremental !== false) {
                        var _anchP = parseSegAnchors(mes.mes);
                        if (Object.keys(_anchP).length) {
                            var _segsP = extractParagraphs(mes.mes);
                            var _exP = computeExistingMap(_segsP, _anchP);
                            var _missP = 0;
                            _segsP.forEach(function (_, k) { if (!_exP[k]) _missP++; });
                            if (!_missP) { if (window.toastr) toastr.info('该消息已全部配图（增量模式）。想全部重新生成，请关闭「增量补图」开关后再点'); return; }
                            if (window.toastr) toastr.info('增量补图：已有 ' + Object.keys(_exP).length + ' 张，缺 ' + _missP + ' 张，只补缺失');
                        }
                    }
                    var segs = extractParagraphs(mes.mes);
                    // [v2.47 诊断] 打印取到的消息与切分结果，便于定位"1/1"等异常
                    try {
                        logInfo('手动配图诊断', 'mesId=' + mes.id + ' name=' + String(mes.name || '') + ' is_user=' + mes.is_user + ' is_system=' + mes.is_system + ' 原文长度=' + String(mes.mes || '').length + ' 增量=' + settings.incremental);
                        logInfo('手动配图诊断', '原文开头300字: ' + JSON.stringify(String(mes.mes || '').slice(0, 300)));
                        logInfo('手动配图诊断', '切分 ' + segs.length + ' 段 | 前3段: ' + JSON.stringify(segs.slice(0, 3)));
                        logInfo('手动配图诊断', '图块数(源码): ' + (String(mes.mes || '').match(/<image[^>]*>[\s\S]*?<\/image>/gi) || []).length + ' | 锚点数: ' + Object.keys(parseSegAnchors(mes.mes || '')).length);
                    } catch (de) { logErr('手动配图诊断', de); }
                    if (!segs.length) { if (window.toastr) toastr.warning('该消息没有可配图段落'); return; }
                    await startBatchJob(mes, segs);
                } catch (err) { hideProgress(); logErr('手动配图', err); console.error(err); if (window.toastr) toastr.error('L·Bridge 失败：' + err.message); }
                return;
            }
            if (window.toastr) toastr.warning('没有可配图的AI消息');
        } finally { doneLock = false; }
    }

    // ==== UI ====
    function fieldsHtml() {
        return '<div class="rpgda-theme-wrap" data-theme="dark">' +
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px;">' +
        '<small>主题</small><select id="rpgda-theme" class="text_pole" style="width:110px;"><option value="dark">粉墨夜间</option><option value="eye">芭乐护眼</option><option value="summer">玉桂夏天</option></select>' +
        '<span style="flex:1;"></span>' +
        '<label class="checkbox_label" style="margin:0;"><input type="checkbox" id="rpgda-enabled"> 启用</label>' +
        '<label class="checkbox_label" style="margin:0;"><input type="checkbox" id="rpgda-autorun"> 自动配图</label>' +
        '<label class="checkbox_label" style="margin:0;"><input type="checkbox" id="rpgda-stream"> 流式配图</label>' +
        '</div>' +
        '' +
        '<div class="rpgda-section"><div class="rpgda-section-title">破限提示词</div>' +
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px;">' +
        '<label class="checkbox_label" style="margin:0;"><input type="checkbox" id="rpgda-bl-enabled"> 启用</label>' +
        '<small style="white-space:nowrap;">注入位置</small>' +
        '<select id="rpgda-bl-pos" class="text_pole" style="flex:1;min-width:120px;">' +
        '<option value="system_prefix">System前置</option>' +
        '<option value="system_suffix">System后置</option>' +
        '<option value="user_prefix">User前置</option>' +
        '<option value="user_suffix">User后置</option>' +
        '</select>' +
        '</div>' +
        '<textarea id="rpgda-bl-prompt" class="text_pole" style="width:100%;height:64px;box-sizing:border-box;margin-top:4px;resize:vertical;" placeholder="输入破限提示词，生图请求时自动注入到所选位置…"></textarea>' +
        '<div style="margin-top:2px;"><small id="rpgda-bl-info" style="color:var(--rpgda-muted);"></small></div>' +
        '</div>' +
        '' +
        '<div class="rpgda-section"><div class="rpgda-section-title">API 设置</div>' +
        '<div style="display:flex;gap:6px;align-items:center;"><small style="width:52px;">端点</small><input id="rpgda-url" class="text_pole" type="text" style="flex:1;box-sizing:border-box;" placeholder="https://.../chat/completions"></div>' +
        '<div style="display:flex;gap:6px;align-items:center;margin-top:4px;"><small style="width:52px;">Key</small><input id="rpgda-key" class="text_pole" type="password" style="flex:1;box-sizing:border-box;" placeholder="sk-..."><button id="rpgda-keytoggle" class="menu_button" style="white-space:nowrap;">👁 显示</button></div>' +
        '<div style="margin-top:2px;"><small id="rpgda-apisrc" style="color:var(--rpgda-muted);word-break:break-all;"></small></div>' +
        '<div style="display:flex;gap:6px;margin-top:4px;"><input id="rpgda-model" class="text_pole" type="text" style="flex:1;box-sizing:border-box;" list="rpgda-modellist" placeholder="模型名"><button id="rpgda-fetchmodels" class="menu_button" style="white-space:nowrap;">拉取模型</button></div>' +
        '<datalist id="rpgda-modellist"></datalist>' +
        '<div id="rpgda-modellist-box" style="margin-top:4px;max-height:120px;overflow-y:auto;"></div>' +
        '<div style="display:flex;gap:8px;margin-top:6px;">' +
        '<div style="flex:1;"><small>Max Tokens</small><input id="rpgda-maxtokens" class="text_pole" type="number" style="width:100%;"></div>' +
        '<div style="flex:1;"><small>并发数</small><input id="rpgda-conc" class="text_pole" type="number" style="width:100%;"></div>' +
        '<div style="flex:1;"><small>超时(秒)</small><input id="rpgda-timeout" class="text_pole" type="number" min="30" max="600" style="width:100%;"></div></div>' +
        '<div style="display:flex;gap:6px;align-items:center;margin-top:4px;"><small style="white-space:nowrap;">渲染批间间隔(ms)</small><input id="rpgda-renderbatchgap" class="text_pole" type="number" min="1000" step="500" style="flex:1;" value="4000"><span class="rpgda-q" data-q="每批生成之间停顿，防429限流。">?</span></div>' +
        '<div style="border-top:1px dashed var(--rpgda-border);margin-top:8px;padding-top:8px;">' +
        '<small style="font-weight:600;">API 预设</small>' +
        '<div style="display:flex;gap:6px;margin-top:4px;"><input id="rpgda-apipreset-name" class="text_pole" type="text" style="flex:1;" placeholder="预设名，如：智谱/DeepSeek"><button id="rpgda-apipreset-save" class="menu_button" style="white-space:nowrap;">保存当前</button></div>' +
        '<div style="display:flex;gap:6px;margin-top:4px;"><select id="rpgda-apipreset-sel" class="text_pole" style="flex:1;"><option value="">— 选择预设 —</option></select><button id="rpgda-apipreset-del" class="menu_button">删除</button></div>' +
        '</div>' +
        '</div>' +
        '' +
        '<div class="rpgda-section"><div class="rpgda-section-title">配图模式</div>' +
        '<div style="display:flex;gap:6px;align-items:center;margin-top:4px;">' +
        '<select id="rpgda-granularity" class="text_pole" style="flex:1;">' +
        '<option value="anchor">自动（正文锚点）</option>' +
        '<option value="sentence">手动·按句（单元=句）</option>' +
        '<option value="paragraph">手动·按段（单元=段）</option>' +
        '</select>' +
        '<input id="rpgda-granstep" class="text_pole" type="number" min="1" max="9" style="width:56px;" title="每几个切一图"><small style="white-space:nowrap;">个一图</small>' +
        '<span class="rpgda-q" data-q="自动（正文锚点）：正文AI在句末写「&lt;!--配图--&gt;」，只在这些地方配图。手动·按句：按句号/问号/感叹号切分，每N句一张图。手动·按段：按自然段切分，每N段一张图。一行（一段）里有多句话时，按句模式会切得更细。两个档位均实际生效。">?</span>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:6px;margin-top:4px;"><small style="white-space:nowrap;">每片单元数</small><input id="rpgda-batchsize" class="text_pole" type="number" min="1" max="20" style="width:60px;"><small style="white-space:nowrap;">单元/片</small><span class="rpgda-q" data-q="每几个画面单元发一次图API请求，防请求被截断。">?</span></div>' +
        '</div>' +
        '' +
        '<div class="rpgda-section"><div class="rpgda-section-title">生图规则来源</div>' +
        '<div style="display:flex;gap:6px;margin-top:4px;">' +
        '<label class="checkbox_label" style="margin:0;flex:1;justify-content:center;padding:4px 0;border:1px solid var(--rpgda-border);border-radius:8px;"><input type="radio" name="rpgda-rulesrc-cat" value="builtin" id="rpgda-cat-builtin-radio"> 内置</label>' +
        '<label class="checkbox_label" style="margin:0;flex:1;justify-content:center;padding:4px 0;border:1px solid var(--rpgda-border);border-radius:8px;"><input type="radio" name="rpgda-rulesrc-cat" value="preset" id="rpgda-cat-preset-radio"> 规则预设</label>' +
        '</div>' +
        '<div id="rpgda-sub-builtin" style="display:none;margin-top:6px;padding:6px 8px;border:1px solid var(--rpgda-border);border-radius:8px;">' +
        '<label class="checkbox_label" style="margin:2px 0;display:flex;gap:6px;"><input type="radio" name="rpgda-builtin-rule" value="flower" id="rpgda-brule-flower"> 油猴世界书二改</label>' +
        '<label class="checkbox_label" style="margin:2px 0;display:flex;gap:6px;"><input type="radio" name="rpgda-builtin-rule" value="builtin" id="rpgda-brule-movie"> 电影大师二改</label>' +
        '</div>' +
        '<div id="rpgda-sub-preset" style="display:none;margin-top:6px;padding:6px 8px;border:1px solid var(--rpgda-border);border-radius:8px;">' +
        '<div id="rpgda-rulepreset-list" style="max-height:130px;overflow-y:auto;"></div>' +
        '<div style="display:flex;gap:6px;margin-top:4px;"><button id="rpgda-rulepreset-edit" class="menu_button" style="flex:1;">编辑所选</button><button id="rpgda-rulepreset-del" class="menu_button" style="flex:1;">删除所选</button></div>' +
        '</div>' +
        '<div style="margin-top:6px;padding:6px 8px;border:1px solid var(--rpgda-border);border-radius:6px;">' +
        '<small style="font-weight:600;">保存/导入规则预设</small>' +
        '<div style="display:flex;gap:6px;margin-top:4px;"><input id="rpgda-rulepreset-name" class="text_pole" type="text" style="flex:1;" placeholder="规则名"><button id="rpgda-rulepreset-save" class="menu_button" style="white-space:nowrap;">保存当前规则</button></div>' +
        '<div style="margin-top:4px;"><small>或粘贴规则文本导入：</small></div>' +
        '<textarea id="rpgda-rulepreset-import" class="text_pole" style="width:100%;height:50px;box-sizing:border-box;margin-top:2px;resize:vertical;" placeholder="把生图规则全文粘贴到这里…"></textarea>' +
        '<div style="display:flex;gap:6px;margin-top:4px;"><input id="rpgda-rulepreset-importname" class="text_pole" type="text" style="flex:1;" placeholder="新规则名"><button id="rpgda-rulepreset-importbtn" class="menu_button" style="white-space:nowrap;">导入为预设</button></div>' +
        '</div>' +
        '<div style="margin-top:4px;"><small id="rpgda-ruleinfo" style="color:var(--rpgda-muted);"></small></div>' +
        '</div>' +
        '' +
        '<div class="rpgda-section"><div class="rpgda-section-title">内容清理</div>' +
        '<div style="display:flex;align-items:center;margin-top:4px;"><small style="font-weight:600;">剔除标签</small><span class="rpgda-q" data-q="AI 输出 &lt;标签&gt;…&lt;/标签&gt; 时整块不参与配图（如 thinking、branches 等）。标签名逗号分隔。可上传预设作者的正则 json 自动提取。">?</span></div>' +
        '<textarea id="rpgda-striptags" class="text_pole" style="width:100%;height:48px;box-sizing:border-box;margin-top:2px;resize:vertical;" placeholder="thinking, meow_FM, branches, aftertalk…"></textarea>' +
        '<div style="display:flex;gap:6px;align-items:center;margin-top:4px;">' +
        '<input type="file" id="rpgda-striptags-file" accept=".json,application/json" style="display:none;">' +
        '<button id="rpgda-striptags-upload" class="menu_button" style="white-space:nowrap;">上传正则文件</button>' +
        '<button id="rpgda-striptags-reset" class="menu_button" style="white-space:nowrap;">恢复默认</button>' +
        '</div>' +
        '<div style="margin-top:2px;"><small id="rpgda-striptags-info" style="color:var(--rpgda-muted);"></small></div>' +
        '<div style="display:flex;align-items:center;margin-top:8px;"><small style="font-weight:600;">正文剔除正则</small><span class="rpgda-q" data-q="生成一个正则表达式，把消息里的 &lt;image&gt; 图块、锚点标记、&lt;content&gt; 壳剔除。复制后导入酒馆的正则替换里，可在显示层清理这些标记。与「剔除标签」不同：剔除标签是运行时不参与配图，正文剔除正则是显示层清理。">?</span></div>' +
        '<div style="display:flex;gap:6px;margin-top:4px;"><button id="rpgda-regexgen" class="menu_button" style="flex:1;">生成正则</button><button id="rpgda-regexcopy" class="menu_button" style="flex:1;">复制到剪贴板</button></div>' +
        '<div style="margin-top:2px;"><small id="rpgda-regex-preview" style="color:var(--rpgda-muted);word-break:break-all;"></small></div>' +
        '</div>' +
        '' +
        '<div class="rpgda-section"><div class="rpgda-section-title">上下文注入</div>' +
        '<div style="display:flex;gap:12px;align-items:center;margin-top:4px;flex-wrap:wrap;">' +
        '<label class="checkbox_label" style="margin:0;"><input type="checkbox" id="rpgda-injchar"> 注入角色卡</label><span class="rpgda-q" data-q="把当前角色的设定描述发给图API，让背景图贴合角色。">?</span>' +
        '<label class="checkbox_label" style="margin:0;"><input type="checkbox" id="rpgda-injhist"> 注入上下文</label><span class="rpgda-q" data-q="把最近几条对话消息发给图API做参考。">?</span>' +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-top:6px;">' +
        '<div style="flex:1;"><small>上下文消息条数</small><input id="rpgda-histerns" class="text_pole" type="number" style="width:100%;"></div>' +
        '<div style="flex:1;"><small>注入上限(字)</small><input id="rpgda-maxctx" class="text_pole" type="number" style="width:100%;"></div>' +
        '<div style="flex:1;"><small>角色简述上限</small><input id="rpgda-charbr" class="text_pole" type="number" style="width:100%;"></div></div>' +
        '</div>' +
        '' +
        '<div class="rpgda-section"><div class="rpgda-section-title">操作</div>' +
        '<div style="display:flex;gap:8px;margin-top:6px;">' +
        '<button id="rpgda-run" class="menu_button" style="flex:1;font-weight:600;">为最后一条消息配图</button>' +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-top:6px;">' +
        '<button id="rpgda-renderall" class="menu_button" style="flex:1;">一键生图</button></div>' +
        '<div style="display:flex;gap:12px;align-items:center;margin-top:6px;flex-wrap:wrap;">' +
        '<label class="checkbox_label" style="margin:0;"><input type="checkbox" id="rpgda-incr"> 增量补图</label><span class="rpgda-q" data-q="开：重复配图只补缺失段，已有图不动；关：每次全部重新生成。">?</span>' +
        '<label class="checkbox_label" style="margin:0;"><input type="checkbox" id="rpgda-autorender"> 插入后自动渲染</label><span class="rpgda-q" data-q="tag 插入完成后自动触发智绘姬生成，不用刷新也不用点按钮。">?</span>' +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-top:6px;">' +
        '<button id="rpgda-save" class="menu_button" style="flex:1;">保存设置</button>' +
        '<button id="rpgda-errbtn" class="menu_button" style="flex:1;">工作日志<span id="rpgda-errbadge" style="display:none;margin-left:6px;background:#e5484d;color:#fff;border-radius:9px;padding:0 6px;font-size:11px;">0</span></button></div>' +
        '<div style="margin-top:6px;padding:6px 8px;border:1px solid var(--rpgda-border);border-radius:6px;"><small id="rpgda-reqstat" style="color:var(--rpgda-muted);">（暂无配图统计，跑完一条消息后显示请求次数与Token）</small></div>' +
        '<div style="margin-top:4px;"><small id="rpgda-status" style="color:var(--rpgda-muted);"></small></div>' +
        '</div>' +
        '</div>';
    }
    function buildDebugLines() {
        var line = [];
        try {
            var w = findRuleEntry();
            var srcName = settings.ruleSource;
            var ruleTxt = getRulePrompt();
            var srcDesc = '内置规则';
            if (srcName === 'flower') srcDesc = '内置·油猴世界书二改';
            if (srcName === 'builtin') srcDesc = '内置·电影大师二改';
            if (srcName === 'worldinfo' || (srcName === 'auto' && w)) srcDesc = '世界书条目' + (w ? '（comment=' + (w.comment || '无') + '，key=' + (w.key || '无') + '）' : '（未找到，已回退内置）');
            if (srcName === 'preset') srcDesc = '规则预设「' + (settings.selectedRulePreset || '无') + '」' + (settings.rulePresets && settings.rulePresets[settings.selectedRulePreset] ? '' : '（未找到，已回退内置）');
            line.push('⭐ 生图规则来源：' + srcDesc);
            var zhjDbg = getZhiHuiJiCharacterDesc();
            line.push(zhjDbg ? ('⭐ 智绘姬角色形象预设（已注入）\n' + zhjDbg) : '⭐ 智绘姬角色形象预设：未读取到（确认智绘姬角色管理里已保存角色外貌）');
            line.push('【规则内容（前600字）】\n' + (ruleTxt || '').slice(0, 600) + (ruleTxt.length > 600 ? '\n…（共' + ruleTxt.length + '字）' : ''));
        } catch (e) { line.push('规则读取异常：' + e.message); }
        try {
            var ctx = getCtx();
            var ch = getCurrentCharacter();
            if (ch) {
                var srcTag = (ctx && ctx.character) ? 'ctx.character' : '兜底匹配';
                line.push('⭐ 角色：' + ch.name + '（来源:' + srcTag + '）\n' + String(ch.description || '').slice(0, 300));
            } else { line.push('⭐ 角色：未读取到当前角色（请确认当前聊天已绑定角色卡）'); }
            if (settings.injectWorldInfo && ctx && Array.isArray(ctx.worldInfo)) {
                var wis = ctx.worldInfo.filter(function (x) { return x && x.constant && x.content; });
                line.push('⭐ 世界书常驻注入（' + wis.length + ' 条）：');
                wis.forEach(function (x) {
                    line.push('  · ' + (x.comment || ('uid:' + x.uid)) + '：' + String(x.content).slice(0, 120) + (x.content.length > 120 ? '…' : ''));
                });
            }
            if (settings.injectCharacter && getCurrentCharacter()) line.push('⭐ 角色注入：开（注入前' + (settings.charBriefLen || 800) + '字）');
            if (settings.injectHistory) line.push('⭐ 剧情注入：开（最近' + (settings.historyTurns || 4) + '条）');
            if (settings.injectWorldInfo) line.push('⭐ 世界书注入：开');
        } catch (e) { line.push('上下文读取异常：' + e.message); }
        try {
            var ctx2 = getCtx();
            var lastMes = ctx2 && Array.isArray(ctx2.chat) ? ctx2.chat[ctx2.chat.length - 1] : null;
            var body = lastMes ? cleanBody(lastMes.mes) : '';
            var segs = (settings.granularity === 'anchor') ? splitSegmentsForMes(lastMes).map(function (p) { return p.text; }) : splitSegments(body).map(function (p) { return p.text; });
            var granDesc = settings.granularity === 'anchor' ? '自动（正文锚点）' : (settings.granularity === 'sentence' ? '手动·按句' : (settings.granularity === 'paragraph' ? '手动·按段' : '自动（正文锚点）')) + (settings.granularity !== 'anchor' ? '，每' + (settings.granStep || 1) + '个一图' : '');
            line.push('【配图粒度】' + granDesc + '，当前消息切出 ' + segs.length + ' 个画面单元');
            line.push('【图API完整请求（system+user，前800字）】\n' + buildDebugRequestPreview(segs));
        } catch (e) { line.push('请求预览异常：' + e.message); }
        return line;
    }
    function showDebug() {
        var line = buildDebugLines();
        var box = document.getElementById('rpgda-debug-body');
        if (box) {
            box.textContent = line.join('\n\n');
            var dp = document.getElementById('rpgda-debug-panel');
            if (dp) dp.style.display = 'block';
        }
    }
    function buildDebugRequestPreview(segs) {
        var sys = getRulePrompt();
        var ctxBlock = buildFullContext();
        var user = (ctxBlock ? ctxBlock + '\n\n---\n\n' : '') +
            '以下是文游正文段落，每段用【P{序号}】开头…（正文）';
        return '【System】\n' + sys.slice(0, 400) + (sys.length > 400 ? '…' : '') + '\n\n【User】\n' + user.slice(0, 400) + (user.length > 400 ? '…' : '');
    }

    // 内联模型按钮列表（手机 WebView 的 datalist/select 不可靠，按钮最稳）
    function renderModelButtons(ids) {
        var box = document.getElementById('rpgda-modellist-box');
        if (!box) return;
        box.innerHTML = '';
        if (!ids || !ids.length) { box.innerHTML = '<small style="color:#9aa4b8;">（无模型）</small>'; return; }
        ids.forEach(function (id) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'menu_button';
            btn.style.cssText = 'margin:2px 4px 2px 0;padding:4px 10px;font-size:12px;';
            btn.textContent = id;
            btn.addEventListener('click', function () {
                try {
                    var $ = window.jQuery;
                    var inp = $('#rpgda-model');
                    if (inp && inp.length) inp.val(id);
                    box.querySelectorAll('button').forEach(function (b) { b.style.borderColor = ''; });
                    btn.style.borderColor = '#4c9aff';
                } catch (e) {}
            });
            box.appendChild(btn);
        });
    }

    function refreshApiPresetSel() {
        var $ = window.jQuery;
        if (!$) return;
        var sel = $('#rpgda-apipreset-sel');
        if (!sel.length) return;
        var cur = sel.val() || '';
        sel.empty();
        sel.append($('<option value="">— 选择预设 —</option>'));
        Object.keys(settings.apiPresets || {}).forEach(function (name) {
            sel.append($('<option value="' + name.replace(/"/g, '&quot;') + '">' + name + '</option>'));
        });
        if (cur && settings.apiPresets[cur]) sel.val(cur);
    }
    function renderRulePresetRadioList() {
        var box = document.getElementById('rpgda-rulepreset-list');
        if (!box) return;
        var names = Object.keys(settings.rulePresets || {});
        if (!names.length) { box.innerHTML = '<small style="color:var(--rpgda-muted);">（还没有保存的规则预设）</small>'; return; }
        var cur = settings.selectedRulePreset || '';
        box.innerHTML = '';
        names.forEach(function (name) {
            var label = document.createElement('label');
            label.style.cssText = 'display:flex;align-items:center;gap:6px;padding:3px 0;cursor:pointer;font-size:12px;';
            var rd = document.createElement('input');
            rd.type = 'radio';
            rd.name = 'rpgda-rulepreset-radio';
            rd.value = name;
            rd.checked = (name === cur);
            rd.style.width = 'auto';
            rd.addEventListener('change', function () {
                settings.ruleSource = 'preset';
                settings.selectedRulePreset = name;
                $('input[name="rpgda-rulesrc-cat"]').prop('checked', false);
                $('#rpgda-cat-preset-radio').prop('checked', true);
                showRuleSub('preset');
                persist();
                ruleInfo();
                v('status').text('已启用规则预设：「' + name + '」');
                if (window.toastr) toastr.success('已启用规则预设：「' + name + '」');
            });
            var span = document.createElement('span');
            span.textContent = name;
            span.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
            label.appendChild(rd);
            label.appendChild(span);
            box.appendChild(label);
        });
    }
    function refreshRulePresetSel() { renderRulePresetRadioList(); }

    // ===== v2.89 三套主题 =====
    var THEMES = {
        dark:   { bg:'#1a1a2e', bg2:'#242440', text:'#e0e0e0', muted:'#8888aa', border:'#3a3a55', accent:'#e8a0bf', check:'#e8a0bf', card:'#1e1e38', cardA:'rgba(30,30,56,0.86)', inputbg:'#252545', qbg:'#2a2a4a' },
        eye:    { bg:'#f2efe4', bg2:'#f3e7e3', text:'#4a3a40', muted:'#8a7a80', border:'#d9cbb8', accent:'#d98ba6', check:'#7fa873', card:'#faf1ec', cardA:'rgba(250,241,236,0.80)', inputbg:'#fbf4ee', qbg:'#efe5dd' },
        summer: { bg:'#eef3f8', bg2:'#e2ebf2', text:'#3a4a5a', muted:'#7a8a9a', border:'#c0d0dc', accent:'#6aa8c8', check:'#6aa8c8', card:'#e8f0f6', cardA:'rgba(232,240,246,0.86)', inputbg:'#f4f8fb', qbg:'#dce6ee' }
    };
    var THEME_DECO = {
        dark:   { emojis: ['💗', '🩷', '🌸', '🌙', '✨', '🫧'], color: '#e8a0bf' },
        eye:    { emojis: ['🍑', '🍋', '🌿', '🍀', '🫧', '☁️'], color: '#e89ab0' },
        summer: { emojis: ['🧊', '🥥', '🌈', '☀️', '🌊', '🫧'], color: '#6aa8c8' }
    };
    function buildDecoSvg(emoji, size, rot) {
        var e = String(emoji || '');
        if (!e) return '';
        var s = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '"><g transform="rotate(' + rot + ' ' + (size / 2) + ' ' + (size / 2) + ')" opacity="0.35"><text x="' + (size / 2) + '" y="' + (size * 0.82) + '" font-size="' + (size * 0.72) + '" text-anchor="middle" style="filter:blur(' + Math.max(2, size / 20) + 'px);">' + e + '</text></g></svg>');
        return 'url("data:image/svg+xml;utf8,' + s + '")';
    }
    function applyTheme(name) {
        var t = THEMES[name] || THEMES.dark;
        // 更新面板内的主题包装（背景改透明，让底部装饰层 #rpgda-deco-layer 透出）
        var wraps = document.querySelectorAll('.rpgda-theme-wrap');
        wraps.forEach(function (w) {
            w.setAttribute('data-theme', name);
            w.style.backgroundColor = 'transparent';
            w.style.color = t.text;
        });
        // 更新已打开的设置面板
        var panel = document.getElementById('rpgda-panel');
        if (panel) {
            panel.style.backgroundColor = t.bg;
            panel.style.color = t.text;
            panel.style.borderColor = t.border;
        }
        // 主题背景装饰：填充独立底层 #rpgda-deco-layer（模糊/低透明 SVG 图片，内容在上层可透出）。
        // v2.96：装饰层已移入滚动内容内（panel-content 内 absolute 铺满内容高度），随内容滚动，
        // 滑到任意位置都能看到装饰（修复"滚动到下面装饰消失"）
        var decoLayer = document.getElementById('rpgda-deco-layer');
        if (decoLayer) {
            var deco = THEME_DECO[name] || THEME_DECO.dark;
            var decoHtml = '';
            var arr = deco.emojis || [];
            // v2.96：9 个位置 3×3 交错均匀分布（顶部/中部/底部各 3 个），间距均匀不扎堆
            var pos = [[8, 5], [38, 3], [72, 7], [6, 48], [50, 50], [88, 45], [8, 88], [45, 92], [82, 86]];
            for (var di = 0; di < pos.length; di++) {
                var em = arr[di % arr.length];
                var sz = 120 + (di % 3) * 30;
                decoHtml += '<span style="position:absolute;left:' + pos[di][0] + '%;top:' + pos[di][1] + '%;font-size:' + sz + 'px;line-height:1;opacity:0.26;filter:blur(4px);transform:rotate(' + (di % 2 ? 12 : -10) + 'deg);user-select:none;">' + em + '</span>';
            }
            decoLayer.innerHTML = decoHtml;
        }
        if (panel) {
            panel.style.backgroundImage = 'none';
            panel.style.backgroundPosition = '';
            panel.style.backgroundSize = '';
            panel.style.backgroundRepeat = '';
        }
        var bar = document.getElementById('rpgda-progress');
        if (bar) {
            bar.style.backgroundColor = t.card;
            bar.style.color = t.text;
            bar.style.borderColor = t.border;
            var barDeco = (THEME_DECO[name] || THEME_DECO.dark);
            if (barDeco && barDeco.emojis && barDeco.emojis.length) {
                bar.style.backgroundImage = buildDecoSvg(barDeco.emojis[0], 40, -8);
                bar.style.backgroundPosition = '50% 50%';
                bar.style.backgroundSize = 'auto 26px';
                bar.style.backgroundRepeat = 'no-repeat';
            }
        }
        // 注入全局 CSS（角标、section 标题、输入框等）
        var styleId = 'rpgda-theme-style';
        var oldStyle = document.getElementById(styleId);
        if (oldStyle) oldStyle.parentNode.removeChild(oldStyle);
        var css = '.rpgda-theme-wrap{--rpgda-muted:' + t.muted + ';--rpgda-border:' + t.border + ';--rpgda-text:' + t.text + ';--rpgda-accent:' + t.accent + ';--rpgda-check:' + (t.check || t.accent) + ';}' +
            '.rpgda-theme-wrap .rpgda-section{margin-top:10px;padding:8px 10px;border:1px solid ' + t.border + ';border-radius:10px;background:' + (t.cardA || t.card) + ';}' +
            '.rpgda-theme-wrap .rpgda-section-title{font-weight:600;font-size:12px;color:' + t.accent + ';margin-bottom:4px;}' +
            '.rpgda-theme-wrap .text_pole{background:' + t.inputbg + '!important;color:' + t.text + '!important;border:1px solid ' + t.border + '!important;}' +
            '.rpgda-theme-wrap .menu_button{background:' + t.inputbg + '!important;color:' + t.text + '!important;border:1px solid ' + t.border + '!important;}' +
            '.rpgda-theme-wrap .menu_button:hover{background:' + t.accent + '22!important;}' +
            '.rpgda-theme-wrap .rpgda-q{display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;border-radius:50%;background:' + t.accent + ';color:' + t.bg + ';font-size:10px;font-weight:700;cursor:pointer;user-select:none;flex-shrink:0;}' +
            '.rpgda-theme-wrap .rpgda-q-box{background:' + t.qbg + ';color:' + t.text + ';border:1px solid ' + t.border + ';}' +
            '.rpgda-theme-wrap #rpgda-errbadge{background:' + (t.check || t.accent) + '!important;}' +
            '.rpgda-theme-wrap small{color:' + t.muted + ';}' +
            '.rpgda-theme-wrap input[type="checkbox"]{appearance:none;-webkit-appearance:none;width:15px;height:15px;border:1.5px solid ' + t.border + ';border-radius:4px;background:' + t.inputbg + ';cursor:pointer;vertical-align:-2px;margin:0;flex-shrink:0;}' +
            '.rpgda-theme-wrap input[type="checkbox"]:checked{background:' + (t.check || t.accent) + ';border-color:' + (t.check || t.accent) + ';background-image:url("data:image/svg+xml;utf8,' + encodeURIComponent("<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 16 16\'><path d=\'M3.5 8.5 L6.5 11.5 L12.5 4.5\' fill=\'none\' stroke=\'white\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/></svg>") + '");background-size:11px 11px;background-position:center;background-repeat:no-repeat;}' +
            '.rpgda-theme-wrap input[type="radio"]{appearance:none;-webkit-appearance:none;width:15px;height:15px;border:1.5px solid ' + t.border + ';border-radius:50%;background:' + t.inputbg + ';cursor:pointer;vertical-align:-2px;margin:0;flex-shrink:0;}' +
            '.rpgda-theme-wrap input[type="radio"]:checked{border-color:' + (t.check || t.accent) + ';background:' + (t.check || t.accent) + ';box-shadow:inset 0 0 0 3.5px ' + t.inputbg + ';}' +
            '.rpgda-theme-wrap .checkbox_label{display:inline-flex;align-items:center;gap:5px;cursor:pointer;}' +
            '.rpgda-theme-wrap input[type="checkbox"]:disabled,input[type="radio"]:disabled{opacity:.5;cursor:not-allowed;}';
        var st = document.createElement('style');
        st.id = styleId;
        st.textContent = css;
        document.head.appendChild(st);
        // 工作日志面板跟随主题
        applyErrTheme(t);
    }
    function applyErrTheme(t) {
        try {
            var dp = document.getElementById('rpgda-err-panel');
            if (!dp) return;
            dp.style.background = (t.bg2 || t.bg);
            dp.style.color = t.text;
            var hd = document.getElementById('rpgda-err-header');
            if (hd) {
                hd.style.background = (t.bg2 || t.bg);
                hd.style.borderBottom = '1px solid ' + t.border;
                hd.style.color = t.text;
            }
            dp.querySelectorAll('.rpgda-wlog-head').forEach(function (h) {
                h.style.borderColor = t.border;
                h.style.background = (t.cardA || t.card);
                h.style.color = t.text;
            });
            dp.querySelectorAll('.rpgda-wlog-hint').forEach(function (sm) { sm.style.color = t.muted; });
            dp.querySelectorAll('.rpgda-wlog-arrow').forEach(function (a) { a.style.color = t.accent; });
            // 展开区/分区条
            dp.querySelectorAll('#rpgda-injbody, #rpgda-apibody, #rpgda-errbody, #rpgda-errtab-err-body, #rpgda-errtab-ok-body, #rpgda-apitab-detail-body').forEach(function (b) {
                b.style.color = t.text;
                b.style.background = 'transparent';
            });
            dp.querySelectorAll('#rpgda-errtab-err, #rpgda-errtab-ok, #rpgda-apitab-detail').forEach(function (b) {
                b.style.borderColor = t.border;
                b.style.background = (t.cardA || t.card);
                b.style.color = t.text;
            });
            dp.querySelectorAll('#rpgda-err-header span[id]').forEach(function (sp) { sp.style.color = t.accent; });
            var c1 = document.getElementById('rpgda-errcopy'); if (c1) c1.style.color = t.check || t.accent;
            var c2 = document.getElementById('rpgda-errclear'); if (c2) c2.style.color = t.accent;
            var c3 = document.getElementById('rpgda-errclose'); if (c3) c3.style.color = t.muted;
        } catch (e) {}
    }
    window.__rpgdaApplyErrTheme = function () { applyErrTheme(THEMES[settings.uiTheme || 'dark'] || THEMES.dark); };

    // ===== v2.89 世界书勾选列表 =====
    function renderWorldInfoChecklist() {
        var box = document.getElementById('rpgda-wi-list');
        if (!box) return;
        try {
            var wis = getAllWorldInfo().filter(function (x) { return x && (x.uid !== undefined || x.id !== undefined || x.comment || x.content); });
            if (!wis.length) { box.innerHTML = '<small style="color:var(--rpgda-muted);">（未能读取到酒馆世界书条目。请确认：① 酒馆「世界信息/World Info」里已建条目且已勾选启用；② 条目分配给当前角色。如果确认有但这里仍为空，请把酒馆版本告诉我。）</small>'; return; }
            var selected = Array.isArray(settings.selectedWorldInfoUids) ? settings.selectedWorldInfoUids : [];
            box.innerHTML = '';
            wis.forEach(function (w) {
                var uid = String(w.uid || w.id || '');
                var label = document.createElement('label');
                label.style.cssText = 'display:flex;align-items:center;gap:6px;padding:3px 0;cursor:pointer;font-size:12px;';
                var cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.checked = (selected.indexOf(uid) !== -1);
                cb.style.width = 'auto';
                cb.addEventListener('change', function () {
                    var cur = Array.isArray(settings.selectedWorldInfoUids) ? settings.selectedWorldInfoUids.slice() : [];
                    if (cb.checked) { if (cur.indexOf(uid) === -1) cur.push(uid); }
                    else { cur = cur.filter(function (x) { return x !== uid; }); }
                    settings.selectedWorldInfoUids = cur;
                    // 勾选了条目 → 自动切到世界书模式；全部取消 → 回退内置
                    settings.ruleSource = cur.length ? 'worldinfo' : 'auto';
                    // 大类 radio 联动：切到世界书子区
                    $('input[name="rpgda-rulesrc-cat"]').prop('checked', false);
                    if (cur.length) $('#rpgda-cat-worldinfo-radio').prop('checked', true);
                    else $('#rpgda-cat-builtin-radio').prop('checked', true);
                    showRuleSub(cur.length ? 'worldinfo' : 'builtin');
                    persist();
                    var _ri = document.getElementById('rpgda-ruleinfo');
                    if (_ri) _ri.textContent = '当前生效：' + (cur.length ? '世界书条目（勾选 ' + cur.length + ' 条）' : '内置规则');
                    var _st = document.getElementById('rpgda-status');
                    if (_st) _st.textContent = '世界书条目已' + (cb.checked ? '勾选：' : '取消：') + (w.comment || ('uid:' + uid)) + '（当前生效模式：' + (cur.length ? '世界书' : '内置') + '）';
                });
                var span = document.createElement('span');
                var tag = w.constant ? '📌常驻' : (w.selective ? '🔑激活' : '');
                var ctt = String(w.content || '');
                span.textContent = (w.comment || ('uid:' + uid)) + (tag ? ' [' + tag + '] ' : ' ') + (ctt ? '（' + ctt.slice(0, 28) + '…）' : '（内容为空）');
                span.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
                label.appendChild(cb);
                label.appendChild(span);
                box.appendChild(label);
            });
        } catch (e) { box.innerHTML = '<small>读取世界书失败：' + e.message + '</small>'; }
    }

    function updateApiSrc() {
        var _as = document.getElementById('rpgda-apisrc');
        if (!_as) return;
        var u = String(settings.apiUrl || '').trim();
        var k = String(settings.apiKey || '').trim();
        var tail = k.length > 8 ? '…' + k.slice(-4) : (k ? '(已填)' : '');
        _as.textContent = u ? ('当前端点：' + u + (tail ? '　·　Key 尾号 ' + tail : '　·　Key 未填')) : '（未配置端点与 Key，拉取模型/生图会失败）';
    }
    function bindFields() {
        var $ = window.jQuery;
        if (!$) { log('无jQuery，无法绑定'); return false; }
        var v = function (id) { return $('#rpgda-' + id); };
        if (!v('enabled').length) { log('字段未就绪'); return false; }
        updateApiSrc();
        v('enabled').prop('checked', settings.enabled);
        v('autorun').prop('checked', settings.autoRun);
        v('stream').prop('checked', settings.streamMode);
        v('bl-enabled').prop('checked', settings.breakLimitEnabled);
        v('bl-pos').val(settings.breakLimitPos || 'system_prefix');
        v('bl-prompt').val(settings.breakLimitPrompt || '');
        v('url').val(settings.apiUrl);
        v('key').val(settings.apiKey);
        v('model').val(settings.model);
        v('maxtokens').val(settings.maxTokens);
        // Key 显示/隐藏切换（默认隐藏，点开可核对）
        var _keyInput = document.getElementById('rpgda-key');
        var _keyToggle = document.getElementById('rpgda-keytoggle');
        if (_keyInput && _keyToggle) {
            _keyToggle.onclick = function () {
                var show = _keyInput.type === 'password';
                _keyInput.type = show ? 'text' : 'password';
                _keyToggle.textContent = show ? '🙈 隐藏' : '👁 显示';
            };
        }
        v('conc').val(settings.concurrency);
        v('timeout').val(settings.requestTimeout || 150);
        v('incr').prop('checked', settings.incremental !== false);
        v('autorender').prop('checked', settings.autoRender !== false);
        v('renderbatchgap').val(settings.renderBatchGap || 4000);
        var _migBtn = document.getElementById('rpgda-migrateold');
        if (_migBtn) {
            _migBtn.onclick = function () { migrateAllOldMessages(); };
        }
        // v2.91：规则来源三分类 UI（内置 radio / 世界书勾选 / 预设 radio）
        (function initRuleSrcUI() {
            var cur = settings.ruleSource;
            // v2.95：世界书选项已移除，旧存档残留的 worldinfo 强制迁移到内置（内置 radio 显示也会落到 builtin）
            if (cur === 'worldinfo') { settings.ruleSource = 'builtin'; cur = 'builtin'; persist(); }
            var catMap = { flower: 'builtin', builtin: 'builtin', worldinfo: 'builtin', preset: 'preset' };
            var cat = catMap[cur] || 'builtin';
            // 大类 radio 勾选
            $('input[name="rpgda-rulesrc-cat"]').prop('checked', false);
            $('#rpgda-cat-' + cat + '-radio').prop('checked', true);
            // 显示对应子区
            showRuleSub(cat);
            // 内置子类 radio 勾选
            $('input[name="rpgda-builtin-rule"]').prop('checked', false);
            if (cur === 'flower') $('#rpgda-brule-flower').prop('checked', true);
            else if (cur === 'builtin') $('#rpgda-brule-movie').prop('checked', true);
        })();
        function showRuleSub(cat) {
            ['builtin', 'worldinfo', 'preset'].forEach(function (c) {
                var el = document.getElementById('rpgda-sub-' + c);
                if (el) el.style.display = (c === cat) ? 'block' : 'none';
            });
            if (cat === 'worldinfo') renderWorldInfoChecklist();
            if (cat === 'preset') renderRulePresetRadioList();
        }
        v('granularity').val(settings.granularity || 'auto');
        v('granstep').val(settings.granStep || 1);
        v('parastep').val(settings.paraStep || 2);
        v('batchsize').val(settings.batchSize || 4);
        v('injchar').prop('checked', settings.injectCharacter);
        v('injhist').prop('checked', settings.injectHistory);
        v('histerns').val(settings.historyTurns);
        v('maxctx').val(settings.maxContextLen);
        v('charbr').val(settings.charBriefLen);
        v('striptags').val(Array.isArray(settings.stripTags) ? settings.stripTags.join(', ') : '');
        refreshApiPresetSel();
        renderRulePresetRadioList();
        var ruleInfo = function () {
            var w = findRuleEntry();
            var label = '内置规则';
            if (settings.ruleSource === 'flower') label = '内置·油猴世界书二改';
            else if (settings.ruleSource === 'builtin') label = '内置·电影大师二改';
            else if (settings.ruleSource === 'worldinfo') label = w ? '世界书条目' : '内置规则（未找到条目）';
            else if (settings.ruleSource === 'preset') label = settings.rulePresets[settings.selectedRulePreset] ? ('规则预设「' + settings.selectedRulePreset + '」') : '内置规则（未选预设）';
            else label = w ? '世界书条目' : '内置规则';
            v('ruleinfo').text('当前生效：' + label);
        };
        ruleInfo();


        // 剔除标签：编辑即时保存
        v('striptags').on('change', function () {
            var raw = String(v('striptags').val() || '');
            var arr = raw.split(/[,，\s]+/).map(function (x) { return x.trim(); }).filter(function (x) { return x; });
            settings.stripTags = arr;
            var okp = persist();
            v('striptags-info').text('已保存 ' + arr.length + ' 个剔除标签' + (okp ? '' : '（⚠ 未持久化，重启丢失）'));
            if (window.toastr) toastr.success('剔除标签已保存：' + arr.join(', '));
        });
        // 破限提示词：编辑即时保存（启用开关/位置/文本框任一变化即保存）
        function saveBreakLimit() {
            settings.breakLimitEnabled = v('bl-enabled').prop('checked');
            settings.breakLimitPos = v('bl-pos').val() || 'system_prefix';
            settings.breakLimitPrompt = v('bl-prompt').val() || '';
            var ok = persist();
            var _len = String(settings.breakLimitPrompt || '').length;
            v('bl-info').text((settings.breakLimitEnabled ? '✅ 已启用' : '⏸ 未启用') + ' · ' + (settings.breakLimitPos || 'system_prefix') + ' · 提示词 ' + _len + ' 字' + (ok ? '' : '（⚠ 未持久化）'));
        }
        v('bl-enabled').on('change', saveBreakLimit);
        v('bl-pos').on('change', saveBreakLimit);
        v('bl-prompt').on('change', saveBreakLimit);
        // 初始化提示信息
        (function () {
            var _len = String(settings.breakLimitPrompt || '').length;
            v('bl-info').text((settings.breakLimitEnabled ? '✅ 已启用' : '⏸ 未启用') + ' · ' + (settings.breakLimitPos || 'system_prefix') + ' · 提示词 ' + _len + ' 字');
        })();
        // 剔除标签：上传正则文件自动提取
        v('striptags-upload').on('click', function () {
            var f = document.getElementById('rpgda-striptags-file');
            if (f) f.click();
        });
        v('striptags-file').on('change', function () {
            var f = this.files && this.files[0];
            if (!f) return;
            var rd = new FileReader();
            rd.onload = function () {
                try {
                    var r = extractTagsFromRegex(rd.result);
                    if (r.err) { v('striptags-info').text('❌ ' + r.err); if (window.toastr) toastr.error('提取失败：' + r.err); return; }
                    if (!r.tags.length) { v('striptags-info').text('⚠ 未提取到自定义标签（文件里有 ' + r.total + ' 条正则，但没找到成对标签）'); if (window.toastr) toastr.warning('未提取到标签'); return; }
                    var cur = Array.isArray(settings.stripTags) ? settings.stripTags.slice() : [];
                    var merged = cur.concat(r.tags.filter(function (t) { return cur.indexOf(t) === -1; }));
                    settings.stripTags = merged;
                    v('striptags').val(merged.join(', '));
                    var okp = persist();
                    v('striptags-info').text('✅ 从 ' + r.total + ' 条正则提取到 ' + r.tags.length + ' 个标签：' + r.tags.join(', ') + '（已合并保存' + (okp ? '' : '，⚠ 未持久化') + '）');
                    if (window.toastr) toastr.success('已提取 ' + r.tags.length + ' 个标签并保存');
                } catch (e) { v('striptags-info').text('❌ 解析失败：' + e.message); }
            };
            rd.readAsText(f);
            this.value = '';
        });
        // 剔除标签：恢复默认
        v('striptags-reset').on('click', function () {
            settings.stripTags = (DEFAULTS.stripTags || []).slice();
            v('striptags').val(settings.stripTags.join(', '));
            persist();
            v('striptags-info').text('已恢复默认 ' + settings.stripTags.length + ' 个标签');
            if (window.toastr) toastr.info('已恢复默认剔除标签');
        });


        v('fetchmodels').on('click', function () {
            v('fetchmodels').prop('disabled', true);
            v('fetchmodels').text('拉取中…');
            // 拉取前先读取输入框最新值，并显示实际请求来源
            settings.apiUrl = (v('url').val() || '').trim() || settings.apiUrl;
            settings.apiKey = (v('key').val() || '').trim() || settings.apiKey;
            var _src = document.getElementById('rpgda-apisrc');
            var _k = String(settings.apiKey || '');
            if (_src) _src.textContent = '正在用端点 ' + (settings.apiUrl || '（未填）') + ' 拉取模型…' + (_k ? '（Key 尾号 …' + _k.slice(-4) + '）' : '（未填 Key）');
            fetchModels().then(function (ids) {
                if (!ids || !ids.length) throw new Error('返回空列表');
                var dl = document.getElementById('rpgda-modellist');
                dl.innerHTML = '';
                ids.forEach(function (id) {
                    var opt = document.createElement('option');
                    opt.value = id;
                    dl.appendChild(opt);
                });
                renderModelButtons(ids);
                var cur = v('model').val();
                if (!cur || ids.indexOf(cur) === -1) v('model').val(ids[0]);
                var _src2 = document.getElementById('rpgda-apisrc');
                if (_src2) _src2.textContent = '拉取来源：' + (settings.apiUrl || '（未填）') + (_k ? '　·　Key 尾号 …' + _k.slice(-4) + '（点👁可核对完整值）' : '　·　Key 未填');
                v('status').text('已拉取 ' + ids.length + ' 个模型，点下面按钮直接选用');
                if (window.toastr) toastr.success('已拉取 ' + ids.length + ' 个模型');
            }).catch(function (err) {
                var msg = (err && err.message ? err.message : String(err));
                var _src3 = document.getElementById('rpgda-apisrc');
                if (_src3) _src3.textContent = '拉取失败：' + msg.slice(0, 160);
                v('status').text('拉取失败：' + msg);
                if (window.toastr) toastr.error('拉取模型失败：' + msg.slice(0, 220));
                logErr('拉取模型', err);
                console.error('[L·Bridge] 拉取模型失败', err);
            }).finally(function () {
                v('fetchmodels').prop('disabled', false);
                v('fetchmodels').text('拉取模型');
            });
        });
        // API 预设：保存当前
        v('apipreset-save').on('click', function () {
            var name = v('apipreset-name').val().trim();
            if (!name) { if (window.toastr) toastr.warning('请先输入预设名'); return; }
            settings.apiPresets[name] = {
                apiUrl: v('url').val().trim(),
                apiKey: v('key').val().trim(),
                model: v('model').val().trim(),
                maxTokens: parseInt(v('maxtokens').val(), 10) || 2048
            };
            var okp = persist();
            refreshApiPresetSel();
            if (okp) { v('status').text('API预设已保存：「' + name + '」（已持久化）'); if (window.toastr) toastr.success('API预设已保存：「' + name + '」'); }
            else { v('status').text('⚠ API预设保存失败：无法写入酒馆设置存储，重启会丢失！').css('color', '#ff8080'); if (window.toastr) toastr.error('API预设未能持久化！'); }
        });
        // API 预设：选择加载
        v('apipreset-sel').on('change', function () {
            var name = v('apipreset-sel').val();
            if (!name || !settings.apiPresets[name]) return;
            var p = settings.apiPresets[name];
            v('url').val(p.apiUrl || '');
            v('key').val(p.apiKey || '');
            v('model').val(p.model || '');
            v('maxtokens').val(p.maxTokens || 2048);
            v('status').text('已加载API预设：「' + name + '」（记得点保存设置生效）');
            if (window.toastr) toastr.info('已加载API预设：「' + name + '」，点保存设置生效');
        });
        // API 预设：删除
        v('apipreset-del').on('click', function () {
            var name = v('apipreset-sel').val();
            if (!name || !settings.apiPresets[name]) { if (window.toastr) toastr.warning('请先选择要删除的预设'); return; }
            delete settings.apiPresets[name];
            persist();
            refreshApiPresetSel();
            v('status').text('已删除API预设：「' + name + '」');
        });
        // 规则预设：保存当前规则
        v('rulepreset-save').on('click', function () {
            var name = v('rulepreset-name').val().trim();
            if (!name) { if (window.toastr) toastr.warning('请先输入规则预设名'); return; }
            var content = getRulePrompt();
            settings.rulePresets[name] = content;
            var okr = persist();
            refreshRulePresetSel();
            if (okr) { v('status').text('规则预设已保存：「' + name + '」(' + content.length + '字，已持久化)'); if (window.toastr) toastr.success('规则预设已保存：「' + name + '」'); }
            else { v('status').text('⚠ 规则预设保存失败：无法写入酒馆设置存储！').css('color', '#ff8080'); if (window.toastr) toastr.error('规则预设未能持久化！'); }
        });
        // 规则预设：删除（取当前 radio 选中项）
        v('rulepreset-del').on('click', function () {
            var rd = document.querySelector('input[name="rpgda-rulepreset-radio"]:checked');
            var name = rd ? rd.value : '';
            if (!name || !settings.rulePresets[name]) { if (window.toastr) toastr.warning('请先勾选要删除的规则预设'); return; }
            delete settings.rulePresets[name];
            if (settings.selectedRulePreset === name) { settings.selectedRulePreset = ''; settings.ruleSource = 'auto'; }
            persist();
            renderRulePresetRadioList();
            ruleInfo();
            v('status').text('已删除规则预设：「' + name + '」');
        });
        // 规则预设：导入文本为新预设
        v('rulepreset-importbtn').on('click', function () {
            var content = String(v('rulepreset-import').val() || '').trim();
            if (!content) { if (window.toastr) toastr.warning('请先粘贴规则文本'); return; }
            var name = String(v('rulepreset-importname').val() || '').trim();
            if (!name) { if (window.toastr) toastr.warning('请先输入规则预设名'); return; }
            settings.rulePresets[name] = content;
            settings.selectedRulePreset = name;
            settings.ruleSource = 'preset';
            persist();
            renderRulePresetRadioList();
            ruleInfo();
            v('status').text('已导入规则预设：「' + name + '」(' + content.length + '字)并自动启用');
            if (window.toastr) toastr.success('已导入规则预设：「' + name + '」');
        });
        // 主开关即时生效（不点保存也立即写入 settings 并持久化）
        v('enabled').on('change', function () {
            settings.enabled = v('enabled').prop('checked');
            persist();
            v('status').text('「启用」已' + (settings.enabled ? '开启' : '关闭') + '（已保存）');
            if (window.toastr) toastr[settings.enabled ? 'success' : 'warning']('L·Bridge ' + (settings.enabled ? '已启用' : '已停用'));
        });
        v('autorun').on('change', function () {
            settings.autoRun = v('autorun').prop('checked');
            persist();
            if (settings.autoRun) { v('status').text('「自动配图」已开启：之后AI回复会自动配图，无需手动（已保存）'); if (window.toastr) toastr.success('自动配图已开启：AI回复后将自动配图'); }
            else { v('status').text('「自动配图」已关闭：需手动点「为最后一条消息配图」（已保存）'); if (window.toastr) toastr.warning('自动配图已关闭'); }
        });
        v('batchsize').on('change', function () {
            settings.batchSize = parseInt(v('batchsize').val(), 10) || 4;
            persist();
        });
        v('stream').on('change', function () {
            settings.streamMode = v('stream').prop('checked');
            persist();
            v('status').text('「流式配图」已' + (settings.streamMode ? '开启（AI边写边配）' : '关闭（AI写完再配）') + '（已保存）');
        });
        v('autorender').on('change', function () {
            settings.autoRender = v('autorender').prop('checked');
            persist();
            v('status').text('「插入后自动渲染」已' + (settings.autoRender ? '开启（插入后自动触发智绘姬生成）' : '关闭（需手动点一键渲染）') + '（已保存）');
        });
        // ===== v2.89 新增绑定 =====
        // 主题切换
        v('theme').val(settings.uiTheme || 'dark');
        v('theme').on('change', function () {
            settings.uiTheme = v('theme').val();
            applyTheme(settings.uiTheme);
            persist();
        });
        applyTheme(settings.uiTheme || 'dark');

        // 角标点击展开说明
        document.querySelectorAll('.rpgda-q').forEach(function (q) {
            q.addEventListener('click', function (e) {
                e.stopPropagation();
                var txt = this.getAttribute('data-q') || '';
                var existing = this.nextElementSibling;
                if (existing && existing.classList && existing.classList.contains('rpgda-q-box')) {
                    existing.style.display = (existing.style.display === 'none') ? 'block' : 'none';
                    return;
                }
                var box = document.createElement('div');
                box.className = 'rpgda-q-box';
                box.style.cssText = 'margin-top:4px;padding:6px 8px;border-radius:6px;font-size:11px;line-height:1.5;max-width:100%;word-break:break-word;';
                box.textContent = txt;
                this.parentNode.insertBefore(box, this.nextSibling);
            });
        });

        // v2.92：规则来源 —— 先选大类（内置/世界书/规则预设），再选该大类下的子类
        $('input[name="rpgda-rulesrc-cat"]').on('change', function () {
            var cat = $(this).val();
            showRuleSub(cat);
            // 切换大类时不改动 ruleSource 的子类值，只记忆当前大类；规则内容由子类/勾选决定
            persist();
            ruleInfo();
        });
        // 内置 radio（FLOWER / 电影大师）——选中即生效
        $('input[name="rpgda-builtin-rule"]').on('change', function () {
            settings.ruleSource = $(this).val();
            persist();
            ruleInfo();
            if (window.toastr) toastr.success('已启用内置规则：' + (settings.ruleSource === 'flower' ? '油猴世界书二改' : '电影大师二改'));
        });

        // 规则预设编辑按钮
        var editBtn = document.getElementById('rpgda-rulepreset-edit');
        if (editBtn) {
            editBtn.onclick = function () {
                var rd = document.querySelector('input[name="rpgda-rulepreset-radio"]:checked');
                var name = rd ? rd.value : '';
                if (!name || !settings.rulePresets || !settings.rulePresets[name]) {
                    if (window.toastr) toastr.warning('请先勾选要编辑的规则预设');
                    return;
                }
                var txt = prompt('编辑规则预设「' + name + '」（可直接修改文本，确定后保存）：', settings.rulePresets[name]);
                if (txt !== null) {
                    settings.rulePresets[name] = txt;
                    settings.selectedRulePreset = name;
                    settings.ruleSource = 'preset';
                    persist();
                    renderRulePresetRadioList();
                    ruleInfo();
                    if (window.toastr) toastr.success('已更新规则预设「' + name + '」');
                }
            };
        }

        v('save').on('click', function () {
            settings.enabled = v('enabled').prop('checked');
            settings.autoRun = v('autorun').prop('checked');
            settings.streamMode = v('stream').prop('checked');
            settings.breakLimitEnabled = v('bl-enabled').prop('checked');
            settings.breakLimitPos = v('bl-pos').val() || 'system_prefix';
            settings.breakLimitPrompt = v('bl-prompt').val() || '';
            settings.apiUrl = v('url').val().trim();
            settings.apiKey = v('key').val().trim();
            updateApiSrc();
            settings.model = v('model').val().trim();
            settings.maxTokens = parseInt(v('maxtokens').val(), 10) || 2048;
            settings.concurrency = parseInt(v('conc').val(), 10) || 2;
            settings.requestTimeout = parseInt(v('timeout').val(), 10) || 150;
            settings.incremental = v('incr').prop('checked');
            settings.autoRender = v('autorender').prop('checked');
            settings.renderBatchGap = parseInt(v('renderbatchgap').val(), 10) || 4000;
            var _rs = document.querySelector('input[name="rpgda-builtin-rule"]:checked');
            settings.ruleSource = _rs ? _rs.value : settings.ruleSource;
            settings.granularity = v('granularity').val() || 'auto';
            settings.granStep = parseInt(v('granstep').val(), 10) || 1;
            settings.paraStep = parseInt(v('parastep').val(), 10) || 2;
            settings.batchSize = parseInt(v('batchsize').val(), 10) || 4;
            settings.injectCharacter = v('injchar').prop('checked');
            settings.injectHistory = v('injhist').prop('checked');
            settings.historyTurns = parseInt(v('histerns').val(), 10) || 4;
            settings.maxContextLen = parseInt(v('maxctx').val(), 10) || 6000;
            settings.charBriefLen = parseInt(v('charbr').val(), 10) || 800;
            var ok = persist();
            ruleInfo();
            if (ok) {
                v('status').text('已保存 ✓ 已写入酒馆设置存储（重启不丢）').css('color', '#7fd97f');
                if (window.toastr) toastr.success('设置已保存并持久化');
            } else {
                v('status').text('⚠ 保存失败：未能写入酒馆设置存储，重启后会丢失！').css('color', '#ff8080');
                if (window.toastr) toastr.error('设置未能持久化！重启会丢失，请反馈此问题');
                logErr('设置持久化失败', new Error('persist() 返回 false：getContext().saveSettingsDebounced 与全局 saveSettingsDebounced 均不可用'));
            }
        });
        v('errbtn').on('click', function () {
            openErrPanel();
        });
        v('run').on('click', function () {
            v('status').text('处理中…');
            processLastMessage().finally(function () { v('status').text('完成或失败见提示'); });
        });
        v('renderall').on('click', function () { triggerZhiHuiJiRender({ batching: true }); });
        // 生成「正文剔除正则」：把历史消息里的 <image>块 + <!--seg-->锚点 + <content>壳 剔除，
        // 让正文模型看到干净剧情历史（解决 roll 句子雷同 + tag 噪声占token）。
        // 输出两种格式：①SillyTavern 正则 JSON（可导入）；②简化 find_regex/replace_string（手填）
        var REGEX_TAG = 'rpgda-regex';
        var _lastRegexText = '';
        function buildRegexJson() {
            var fr = String.raw`<image[^>]*>[\s\S]*?<\/image>|<!--\s*(?:seg|rpgda-seg):[^>]*-->|<content[^>]*>|<\/content>`;
            var obj = {
                regex_scripts: [{
                    scriptName: 'L·Bridge-正文剔除图块',
                    findRegex: fr,
                    replaceString: ' ',
                    trimStrings: false,
                    placement: [0, 1],
                    disabled: false,
                    markdownOnly: false,
                    promptOnly: true,
                    runOnEdit: true,
                    substituteRegex: false,
                    minDepth: 0,
                    maxDepth: 100
                }]
            };
            return JSON.stringify(obj, null, 2);
        }
        v('regexgen').on('click', function () {
            try {
                var full = buildRegexJson();
                var fr = String.raw`<image[^>]*>[\s\S]*?<\/image>|<!--\s*(?:seg|rpgda-seg):[^>]*-->|<content[^>]*>|<\/content>`;
                var simple = 'find: ' + fr + '\nreplace: 空格';
                _lastRegexText = '【方式A：酒馆正则 JSON（推荐，完整剔除 tag/锚点/content壳）】\n' + full + '\n\n【方式B：手填简化版】\n' + simple;
                var prev = document.getElementById('rpgda-regex-preview');
                if (prev) {
                    prev.textContent = '已生成。点「复制到剪贴板」→ 酒馆「扩展」→ 正则 里新建/导入。作用：正文请求前剔除图块和锚点，正文模型只见干净剧情（roll 不再被旧 tag 带跑）。';
                }
                if (window.toastr) toastr.success('已生成正文剔除正则，复制后在酒馆正则里导入');
                logInfo('正文剔除正则', '已生成，点击复制按钮使用');
            } catch (e) { logErr('正则生成', e); }
        });
        v('regexcopy').on('click', function () {
            try {
                if (!_lastRegexText) { v('regexgen').trigger('click'); }
                if (!_lastRegexText) return;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(_lastRegexText).then(function () {
                        v('status').text('正则已复制到剪贴板，去酒馆正则里粘贴导入（建议勾选「在提示词中生效」）').css('color', '#7fd97f');
                        if (window.toastr) toastr.success('已复制正文剔除正则');
                    }).catch(function () { copyFallback(_lastRegexText); });
                } else { copyFallback(_lastRegexText); }
            } catch (e) { logErr('正则复制', e); }
        });
        function copyFallback(txt) {
            try {
                var ta = document.createElement('textarea');
                ta.value = txt;
                ta.style.position = 'fixed'; ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                v('status').text('已复制（兼容模式）').css('color', '#7fd97f');
            } catch (e2) { v('status').text('复制失败，请手动全选复制'); }
        }
        return true;
    }

    function ensureDebugPanel() {
        if (document.getElementById('rpgda-debug-panel')) return;
        var dp = document.createElement('div');
        dp.id = 'rpgda-debug-panel';
        dp.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;overflow-y:auto;-webkit-overflow-scrolling:touch;background:#141821;color:#d5dbe6;z-index:2147483000;padding:14px 16px 56px;box-sizing:border-box;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;line-height:1.6;white-space:pre-wrap;display:none;';
        dp.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:#141821;padding:6px 0;z-index:2;"><b>🔍 注入预览</b><span id="rpgda-debug-close" style="cursor:pointer;font-size:20px;color:#999;">✕</span></div><div id="rpgda-debug-body"></div>';
        dp.querySelector('#rpgda-debug-close').addEventListener('click', function () { dp.style.display = 'none'; });
        document.body.appendChild(dp);
    }

    function ensurePanel() {
        try {
            var _oldP = document.getElementById('rpgda-panel');
            if (_oldP && _oldP.parentNode) _oldP.parentNode.removeChild(_oldP);
            var _oldO = document.getElementById('rpgda-overlay');
            if (_oldO && _oldO.parentNode) _oldO.parentNode.removeChild(_oldO);
        } catch (e) {}
        if (document.getElementById('rpgda-panel')) return;
        var ov = document.createElement('div');
        ov.id = 'rpgda-overlay';
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99998;display:none;';
        ov.addEventListener('click', function () { closePanel(); });
        var panel = document.createElement('div');
        panel.id = 'rpgda-panel';
        var isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.innerWidth < 900) || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
        panel.style.cssText = isMobile
            ? 'position:fixed;top:0;left:0;width:100vw;height:100vh;max-height:100vh;overflow-y:auto;-webkit-overflow-scrolling:touch;background:#1f2430;color:#e6e6e6;border:none;border-radius:0;z-index:99999;padding:14px 16px 56px;box-sizing:border-box;font-family:-apple-system,system-ui,\'PingFang SC\',\'Microsoft YaHei\',sans-serif;font-size:13px;line-height:1.5;display:none;'
            : 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(92vw,460px);max-height:84vh;overflow-y:auto;background:#1f2430;color:#e6e6e6;border:1px solid #3a4152;border-radius:14px;box-shadow:0 8px 40px rgba(0,0,0,0.55);z-index:99999;padding:16px 18px;font-family:-apple-system,system-ui,\'PingFang SC\',\'Microsoft YaHei\',sans-serif;font-size:13px;line-height:1.5;display:none;';
        panel.innerHTML = '<div id="rpgda-panel-content" style="position:relative;z-index:1;">' +
          '<div id="rpgda-deco-layer" style="position:absolute;top:0;left:0;width:100%;height:100%;overflow:hidden;pointer-events:none;z-index:0;"></div>' +
          '<div id="rpgda-panel-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;cursor:move;user-select:none;padding:4px 0;position:relative;z-index:2;">' +
          '<b style="font-size:14px;">🎮 L·Bridge ' + PLUGIN_VER + '</b>' +
          '<div style="display:flex;gap:10px;align-items:center;">' +
          '<span id="rpgda-panel-min" style="cursor:pointer;font-size:16px;color:#999;font-weight:700;">—</span>' +
          '<span id="rpgda-panel-close" style="cursor:pointer;font-size:18px;color:#999;">✕</span></div></div>' +
          '<div id="rpgda-panel-body" style="position:relative;z-index:2;">' + fieldsHtml() + '</div></div>';
        document.body.appendChild(ov);
        document.body.appendChild(panel);
        var close = document.getElementById('rpgda-panel-close');
        if (close) close.addEventListener('click', closePanel);
        // 最小化/还原
        var minBtn = document.getElementById('rpgda-panel-min');
        if (minBtn) minBtn.addEventListener('click', function () {
            var body = document.getElementById('rpgda-panel-body');
            if (body) {
                var hidden = body.style.display === 'none';
                body.style.display = hidden ? 'block' : 'none';
                minBtn.textContent = hidden ? '—' : '▢';
            }
        });
        // 桌面端拖动
        if (!isMobile) {
            var header = document.getElementById('rpgda-panel-header');
            var dragging = false, offX = 0, offY = 0;
            if (header) {
                header.addEventListener('mousedown', function (e) {
                    dragging = true;
                    var rect = panel.getBoundingClientRect();
                    offX = e.clientX - rect.left;
                    offY = e.clientY - rect.top;
                    panel.style.transform = 'none';
                    panel.style.left = rect.left + 'px';
                    panel.style.top = rect.top + 'px';
                    e.preventDefault();
                });
                document.addEventListener('mousemove', function (e) {
                    if (!dragging) return;
                    panel.style.left = (e.clientX - offX) + 'px';
                    panel.style.top = (e.clientY - offY) + 'px';
                });
                document.addEventListener('mouseup', function () { dragging = false; });
            }
        }
        bindFields();
        setTimeout(function () { applyTheme(settings.uiTheme || 'dark'); }, 50);
    }
    function openPanel() {
        ensurePanel();
        document.getElementById('rpgda-panel').style.display = 'block';
        document.getElementById('rpgda-overlay').style.display = 'block';
        // v2.96：面板打开时进度条让位——移动端状态栏最小化后固定在顶部，会挡住全屏面板的退出按钮；
        // 打开面板期间临时隐藏进度条（写 tag 进行中仍正常请求，只是不显示浮层），关闭面板后恢复
        try {
            var _pb = document.getElementById('rpgda-progress');
            if (_pb && _pb.style.display !== 'none') {
                _pb.setAttribute('data-rpgda-hide-by-panel', '1');
                _pb.style.display = 'none';
            }
        } catch (e) {}
    }
    function closePanel() {
        var p = document.getElementById('rpgda-panel'), o = document.getElementById('rpgda-overlay');
        if (p) p.style.display = 'none';
        if (o) o.style.display = 'none';
        // v2.96：恢复被面板临时隐藏的进度条（v2.96.2：若用户已最小化则不弹回，保持收起）
        try {
            var _pb2 = document.getElementById('rpgda-progress');
            if (_pb2 && _pb2.getAttribute('data-rpgda-hide-by-panel') === '1') {
                _pb2.removeAttribute('data-rpgda-hide-by-panel');
                if (_pb2.dataset.rpgdaMin !== '1') _pb2.style.display = 'block';
            }
        } catch (e) {}
    }

    function ensureMenuEntry(force) {
        try {
            var $ = window.jQuery;
            if (!$) { setTimeout(ensureMenuEntry, 2000); return; }
            var menu = $('#extensionsMenu');
            if (!menu || !menu.length) { setTimeout(ensureMenuEntry, 2000); return; }
            // 已有入口且非强制重建：直接返回（避免每2秒重建导致按钮闪烁/点击丢失）
            var old = document.getElementById('rpgda-menu-btn');
            if (old && !force) return;
            // 幂等重建：先移除旧入口（含历史残留），保证只有一个
            if (old && old.parentNode) old.parentNode.removeChild(old);
            var btn = $('<div id="rpgda-menu-btn" class="list-group-item flex-container flexGap5" tabindex="0" title="L·Bridge设置" style="cursor:pointer;">' +
              '<div class="extensionsMenuExtensionButton"><span style="font-size:16px;">🎮</span></div>' +
              '<span>L·Bridge</span></div>');
            btn.on('click touchend', function (e) {
                if (e && e.stopPropagation) e.stopPropagation();
                try { $(document).trigger('click'); } catch (err) {}
                setTimeout(openPanel, 120);
            });
            menu.prepend(btn);
            log('扩展菜单入口已创建');
        } catch (e) { setTimeout(ensureMenuEntry, 2000); }
    }

    function addSettingsPanel() {
        try {
            // 全局幂等：整个页面只允许一个「L·Bridge」区块（否则多个容器选择器会堆出重复入口）
            if (document.querySelector('.rpg-dual-api-panel')) return;
            var ctx = getCtx();
            var $ = window.jQuery;
            var t = null;
            if ($) {
                if ($('#extensions-settings').length) t = $('#extensions-settings');
                else if ($('#extensions_settings').length) t = $('#extensions_settings');
                else if ($('#extensions_settings2').length) t = $('#extensions_settings2');
                else if ($('.extensionSettings').length) t = $('.extensionSettings').first();
            }
            if (!t && ctx && ctx.extensionSettings && ctx.extensionSettings.append) t = ctx.extensionSettings;
            if (!t) { setTimeout(addSettingsPanel, 2500); return; }
            var html = '<div class="rpg-dual-api-panel" style="padding:10px 14px;">' +
              '<div class="inline-drawer"><div class="inline-drawer-toggle inline-drawer-header"><b>L·Bridge</b>' +
              '<div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>' +
              '<div class="inline-drawer-content" style="padding:8px 2px;">' +
              '<div class="menu_button interactable" id="rpgda-std-open" style="width:100%;justify-content:center;padding:8px 0;">打开设置面板</div>' +
              '<div style="margin-top:6px;color:gray;font-size:12px;">设置统一在设置面板中，也可点右下角🎨或扩展菜单入口。</div>' +
              '</div></div></div>';
            t.append(html);
            var openBtn = t.find('#rpgda-std-open');
            if (openBtn && openBtn.length) openBtn.on('click', openPanel);
            log('旧版容器入口已创建');
            return;
        } catch (e) { setTimeout(addSettingsPanel, 2500); }
    }

    function boot() {
        try {
            ensureMenuEntry(true); // 启动时强制重建一次，吸收历史残留
            addSettingsPanel();
        } catch (e) {}
    }

    setInterval(function () {
        try { ensureMenuEntry(); } catch (e) {}
        try { addSettingsPanel(); } catch (e) {}
    }, 2000);

    function onReady() {
        try {
            // 单例锁（进程级）：无论脚本被加载几次/onReady 被调用几次，全局只初始化一次。
            // 旧版残留的 UI 元素不再当作"已有实例"（会被 boot 幂等清理重建），
            // 避免"装新版后检测到旧元素直接退出不工作"。
            if (window.__rpgdaBooted) {
                console.warn('[L·Bridge] 检测到重复初始化，本实例跳过（若扩展菜单仍有两个入口，请检查扩展目录是否装了两份插件文件）');
                return;
            }
            window.__rpgdaBooted = true;
            var es = getEventSource();
            var et = getEventTypes();
            var mode = '';
            if (es && et && et.GENERATION_ENDED !== undefined) {
                es.on(et.GENERATION_ENDED, function (mesId) {
                    logInfo('自动配图（事件）', '收到生成完成事件 mesId=' + mesId + '，enabled=' + settings.enabled + '，autoRun=' + settings.autoRun);
                    if (settings.enabled && settings.autoRun) onMessageDone(mesId);
                    else logInfo('自动配图（事件）', '因开关未开跳过：enabled=' + settings.enabled + '，autoRun=' + settings.autoRun + '。请在设置面板勾选并确认提示「已保存」');
                });
                if (et.MESSAGE_UPDATED !== undefined) {
                    es.on(et.MESSAGE_UPDATED, onMessageUpdated);
                    mode = settings.streamMode ? '事件+流式' : '事件模式（非流式）';
                } else {
                    mode = '事件模式';
                }
                startPolling();
            } else {
                startPolling();
                mode = '轮询模式';
            }
            var _hint = '';
            if (!settings.enabled) _hint = ' · ⚠「启用」未勾选（当前不工作）';
            else if (!settings.autoRun) _hint = ' · ⚠「自动配图」未勾选（需手动点「为最后一条消息配图」）';
            else if (settings.streamMode) _hint = ' · 流式配图已开：AI边写边配';
            diag('✅ L·Bridge ' + PLUGIN_VER + ' 加载成功 · ' + mode + _hint, 'rgba(30,120,60,0.92)', false);
            boot();
        } catch (e) {
            logErr('初始化', e);
            console.error('[L·Bridge] init err', e);
            diag('⚠ 初始化异常: ' + (e && e.message ? e.message : e), null, true);
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady);
    else onReady();
    setTimeout(onReady, 1500);
    setTimeout(onReady, 3500);

    try {
        var _es = getEventSource(), _et = getEventTypes();
        if (_es && _et && _et.APP_READY !== undefined) _es.on(_et.APP_READY, function () { try { ensureMenuEntry(); } catch (e) {} });
    } catch (e) {}
})();
