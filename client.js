window.__ModuleLoader__.load({
  id: '@local/dsh-latest-call-usage',
  factory(require) {
    const React = require('react');
    const { createPortal } = require('react-dom');
    const h = React.createElement;
    const NS = 'localLatestCallUsage';
    const dictionaries = {
      zh: {
        title: '最近一次 LLM 调用', total: '{count} tokens',
        hit: '缓存命中率', quality: '缓存优度', input: '未缓存输入',
        read: '缓存读取', write: '缓存写入', output: '输出',
        hitSummary: '缓存命中{value}', qualitySummary: '缓存优度 {value}',
        hitHint: '本次缓存读取 ÷ 本次全部输入（未缓存输入 + 缓存读取 + 缓存写入）',
        qualityHint: '本次缓存读取 ÷ 前一次总 tokens（全部输入 + 输出）',
        qualityCalculation: '本次缓存读取 {cached} ÷ 前一次总 tokens {previous} = {value}',
        unavailable: '缺少相邻调用的用量数据或分母为零，无法计算。',
        missingUsage: '这次调用已结束，但没有报告用量。',
      },
      en: {
        title: 'Latest LLM call', total: '{count} tokens',
        hit: 'Cache hit', quality: 'Cache quality', input: 'Uncached input',
        read: 'Cache read', write: 'Cache write', output: 'Output',
        hitSummary: 'Cache hit {value}', qualitySummary: 'Cache quality {value}',
        hitHint: 'This call’s cache reads ÷ all input (uncached input + cache reads + cache writes)',
        qualityHint: 'This call’s cache reads ÷ the previous call’s total tokens (all input + output)',
        qualityCalculation: 'Cache reads {cached} ÷ previous total tokens {previous} = {value}',
        unavailable: 'Adjacent usage is missing or the denominator is zero.',
        missingUsage: 'This call has ended, but no token usage was reported.',
      },
    };
    const css =
      '.dsh-lcu-anchor{display:inline-flex;min-width:0;font-size:12px;line-height:20px}' +
      '.dsh-lcu-pill{display:inline-flex;align-items:center;gap:6px;box-sizing:border-box;max-width:100%;padding:1px 8px;border:0;border-radius:4px;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;line-height:inherit;font-variant-numeric:tabular-nums;white-space:nowrap;cursor:pointer}' +
      '.dsh-lcu-pill svg{width:14px;height:14px;flex:none}' +
      '.dsh-lcu-label{min-width:0;overflow:hidden;text-overflow:ellipsis}' +
      '.dsh-lcu-sep{margin:0 6px;color:var(--dsw-alias-separator-primary)}' +
      '.dsh-lcu-pill[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}' +
      '.dsh-lcu-pill:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}' +
      '@media(hover:hover){.dsh-lcu-pill:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}}' +
      '.dsh-lcu-panel{position:fixed;z-index:1100;box-sizing:border-box;width:max-content;min-width:min(300px,calc(100vw - 24px));max-width:min(440px,calc(100vw - 24px));padding:16px;border:.5px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);box-shadow:0 4px 16px color-mix(in srgb,var(--dsw-alias-label-primary) 12%,transparent);font-family:inherit;font-size:12px;line-height:18px;overflow:auto;cursor:default}' +
      '.dsh-lcu-title{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:8px;color:var(--dsw-alias-label-primary);font-weight:500}' +
      '.dsh-lcu-total{font-variant-numeric:tabular-nums;white-space:nowrap}' +
      '.dsh-lcu-rule{border-top:.5px solid var(--dsw-alias-border-l2);margin-bottom:10px}' +
      '.dsh-lcu-details{display:grid;grid-template-columns:minmax(76px,auto) minmax(0,1fr);gap:6px 16px;margin:0;color:var(--dsw-alias-label-tertiary)}' +
      '.dsh-lcu-details dt,.dsh-lcu-details dd{margin:0;min-width:0}' +
      '.dsh-lcu-details dd{text-align:right;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}';

    function exact(value) {
      return value === null || value === undefined ? '—' : String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    function compact(value) {
      if (value === null || value === undefined) return '—';
      const scaled = n => String(Math.round(n * (n >= 100 ? 1 : 10)) / (n >= 100 ? 1 : 10));
      if (value < 1000) return String(value);
      return value < 1000000 ? scaled(value / 1000) + 'K' : scaled(value / 1000000) + 'M';
    }
    // Integer arithmetic preserves the distinction between a partial and full hit.
    function percentage(numerator, denominator, bounded = false) {
      if (numerator == null || denominator == null || denominator <= 0) return '—';
      const n = BigInt(numerator), d = BigInt(denominator);
      let digits = 1, scale = 10n;
      let units = (n * 200n * scale + d) / (2n * d);
      while (bounded && n < d && units >= 100n * scale) {
        digits++;
        scale *= 10n;
        units = (n * 200n * scale + d) / (2n * d);
      }
      const raw = String(units).padStart(digits + 1, '0');
      const fraction = raw.slice(-digits).replace(/0+$/, '');
      return raw.slice(0, -digits) + (fraction ? '.' + fraction : '') + '%';
    }
    function Icon() {
      return h('svg', { viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.25, 'aria-hidden': true },
        h('circle', { cx: 8, cy: 8, r: 5.5 }), h('path', { d: 'M8 4.5V8l2.5 1.5', strokeLinecap: 'round', strokeLinejoin: 'round' }));
    }
    function LatestCallUsage({ useProjection, t }) {
      const stats = useProjection('localLatestCallUsage');
      const [open, setOpen] = React.useState(false);
      const [position, setPosition] = React.useState(null);
      const anchorRef = React.useRef(null);
      const buttonRef = React.useRef(null);
      const panelRef = React.useRef(null);
      const panelId = React.useId();
      const titleId = panelId + '-title';
      const measure = React.useCallback(() => {
        if (!anchorRef.current || !panelRef.current) return;
        const anchor = anchorRef.current.getBoundingClientRect();
        const panel = panelRef.current.getBoundingClientRect();
        const viewport = window.visualViewport;
        const vx = viewport?.offsetLeft ?? 0, vy = viewport?.offsetTop ?? 0;
        const vw = viewport?.width ?? window.innerWidth, vh = viewport?.height ?? window.innerHeight;
        const margin = 12, gap = 8;
        const maxWidth = Math.max(0, Math.min(440, vw - margin * 2));
        const above = Math.max(0, anchor.top - vy - margin - gap);
        const below = Math.max(0, vy + vh - margin - anchor.bottom - gap);
        const onTop = panel.height <= above || above >= below;
        const maxHeight = onTop ? above : below;
        const height = Math.min(panel.height, maxHeight), width = Math.min(panel.width, maxWidth);
        const next = {
          left: Math.max(vx + margin, Math.min(anchor.left, vx + vw - margin - width)),
          top: onTop ? anchor.top - gap - height : anchor.bottom + gap,
          minWidth: Math.min(300, maxWidth), maxWidth, maxHeight,
        };
        setPosition(previous => previous !== null && Object.keys(next).every(key => previous[key] === next[key]) ? previous : next);
      }, []);
      React.useLayoutEffect(() => {
        if (!open) return;
        measure();
        window.addEventListener('resize', measure);
        window.addEventListener('scroll', measure, true);
        const viewport = window.visualViewport;
        viewport?.addEventListener('resize', measure);
        viewport?.addEventListener('scroll', measure);
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
        if (anchorRef.current) observer?.observe(anchorRef.current);
        if (panelRef.current) observer?.observe(panelRef.current);
        return () => {
          window.removeEventListener('resize', measure);
          window.removeEventListener('scroll', measure, true);
          viewport?.removeEventListener('resize', measure);
          viewport?.removeEventListener('scroll', measure);
          observer?.disconnect();
        };
      }, [open, measure]);
      React.useLayoutEffect(() => { if (open) measure(); }, [open, stats, measure]);
      React.useEffect(() => {
        if (!open) return;
        const outside = event => {
          if (event.target instanceof Node && !anchorRef.current?.contains(event.target) && !panelRef.current?.contains(event.target)) setOpen(false);
        };
        const keydown = event => {
          if (event.key === 'Escape') {
            setOpen(false);
            buttonRef.current?.focus({ preventScroll: true });
          }
        };
        document.addEventListener('pointerdown', outside, true);
        document.addEventListener('click', outside, true);
        document.addEventListener('keydown', keydown);
        return () => {
          document.removeEventListener('pointerdown', outside, true);
          document.removeEventListener('click', outside, true);
          document.removeEventListener('keydown', keydown);
        };
      }, [open]);
      if (stats == null) return null;
      const usage = stats.usage;
      const input = usage == null ? null : usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
      const hit = percentage(usage?.cacheReadTokens, input, true);
      const quality = percentage(usage?.cacheReadTokens, stats.previousTotalTokens);
      const segments = [compact(usage?.totalTokens), t('hitSummary', { value: hit }), t('qualitySummary', { value: quality })];
      const qualityHint = usage !== null && stats.previousTotalTokens > 0
        ? t('qualityCalculation', { cached: exact(usage.cacheReadTokens), previous: exact(stats.previousTotalTokens), value: quality })
        : t('qualityHint') + ' — ' + t('unavailable');
      const rows = [
        ['hit', hit, t('hitHint')], ['quality', quality, qualityHint],
        ['input', exact(usage?.inputTokens)], ['read', exact(usage?.cacheReadTokens)],
        ...(usage != null && usage.cacheWriteTokens > 0 ? [['write', exact(usage.cacheWriteTokens)]] : []),
        ['output', exact(usage?.outputTokens)],
      ];
      const panel = open ? h('div', {
        ref: panelRef, id: panelId, role: 'dialog', 'aria-labelledby': titleId,
        className: 'dsh-lcu-panel', 'data-latest-call-usage-details': true,
        style: position ?? { visibility: 'hidden', left: 0, top: 0 },
      },
        h('div', { className: 'dsh-lcu-title' },
          h('span', { id: titleId }, t('title')),
          h('span', { className: 'dsh-lcu-total', title: usage === null ? t('missingUsage') : undefined }, t('total', { count: exact(usage?.totalTokens) }))),
        h('div', { className: 'dsh-lcu-rule', 'aria-hidden': true }),
        h('dl', { className: 'dsh-lcu-details' }, rows.flatMap(([key, value, hint]) => [
          h('dt', { key: key + '-label', title: hint }, t(key)),
          h('dd', { key: key + '-value', title: hint ?? (usage === null ? t('missingUsage') : undefined) }, value),
        ]))) : null;
      return h('span', { ref: anchorRef, className: 'dsh-lcu-anchor', 'data-composer-stat': 'latest-call-usage' },
        h('style', null, css),
        h('button', {
          ref: buttonRef, type: 'button', className: 'dsh-lcu-pill',
          'aria-haspopup': 'dialog', 'aria-expanded': open, 'aria-controls': open ? panelId : undefined,
          'aria-label': t('title') + ': ' + segments.join(' · '),
          onClick: () => { setPosition(null); setOpen(value => !value); },
        }, h(Icon), h('span', { className: 'dsh-lcu-label' }, segments.map((segment, i) => h(React.Fragment, { key: i },
          i > 0 ? h('span', { className: 'dsh-lcu-sep', 'aria-hidden': true }, '·') : null, segment)))),
        panel === null ? null : createPortal(panel, document.body));
    }
    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, dictionaries));
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock', id: 'local-latest-call-usage', order: 2, locale: NS,
        }, LatestCallUsage));
      },
    };
  },
});
