(function (global, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    global.WrcRunClubEmbed = factory();
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var DEFAULTS = {
    clubName: 'WRC',
    width: 420,
    height: 340,
    backgroundColor: 'transparent',
    textColor: '#FFFFFF',
    starColor: '#FFFFFF',
    shoeColor: '#FFFFFF',
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 180,
    sliceCount: 12,
    autoPlay: true,
    replayOnVisible: false
  };

  var STYLE_ID = 'wrc-runclub-embed-style';

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.wrc-logo-wrap{height:100%;width:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;}',
      '.wrc-stage{position:relative;overflow:hidden;}',
      '.wrc-blind-slice{position:absolute;top:0;left:0;width:100%;height:100%;clip-path:inset(0 100% 0 0);}',
      '.wrc-star-icon{opacity:0;transform:scale(0) rotate(-30deg);transition:opacity .25s cubic-bezier(.34,1.56,.64,1),transform .35s cubic-bezier(.34,1.56,.64,1);}',
      '.wrc-star-icon.punched{opacity:1;transform:scale(1) rotate(0deg);}',
      '.wrc-shoe-runner{position:absolute;top:50%;left:-20%;transform:translateY(-50%);opacity:0;z-index:20;pointer-events:none;}',
      '.wrc-shoe-runner.running{opacity:1;animation:wrcShoeRun 1.8s cubic-bezier(.25,.1,.25,1) forwards;}',
      '@keyframes wrcShoeRun{0%{left:-20%;opacity:1;transform:translateY(-50%) rotate(0deg)}15%{transform:translateY(-50%) rotate(-8deg) translateY(-6px)}30%{transform:translateY(-50%) rotate(4deg) translateY(0)}45%{transform:translateY(-50%) rotate(-8deg) translateY(-6px)}60%{transform:translateY(-50%) rotate(4deg) translateY(0)}75%{transform:translateY(-50%) rotate(-6deg) translateY(-4px)}85%{left:110%;opacity:1;transform:translateY(-50%) rotate(2deg)}100%{left:120%;opacity:0;transform:translateY(-50%) rotate(0deg)}}'
    ].join('');
    document.head.appendChild(style);
  }

  function star(id, tx, ty, scale) {
    return '<g class="wrc-star-icon" id="' +
      id +
      '" transform="translate(' + tx + ',' + ty + ') scale(' + scale + ')"><polygon class="wrc-star-shape" points="20,0 26,14 40,14 28,22 32,38 20,28 8,38 12,22 0,14 14,14" /></g>';
  }

  function buildSvg(config) {
    return (
      '<svg viewBox="0 0 420 340" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="position:absolute;top:0;left:0;width:100%;height:100%;">' +
      '<g>' +
      star('wrc-star1', 105, 45, 0.6) +
      star('wrc-star2', 145, 28, 0.6) +
      star('wrc-star3', 190, 18, 0.7) +
      star('wrc-star4', 237, 28, 0.6) +
      star('wrc-star5', 277, 45, 0.6) +
      '</g>' +
      '<text x="210" y="260" text-anchor="middle" class="wrc-text" style="fill:' +
      config.textColor +
      ';font-family:' +
      config.fontFamily +
      ';font-size:' +
      config.fontSize +
      'px;letter-spacing:.08em;">' +
      config.clubName +
      '</text></svg>'
    );
  }

  function buildShoe(color) {
    return (
      '<svg width="70" height="44" viewBox="0 0 70 44" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M8 30C8 30 4 28 3 24C2 20 5 16 8 14C11 12 16 10 20 10L28 8C30 7 34 6 38 7C42 8 44 10 46 10L54 9C56 8.5 60 8 63 10C66 12 67 16 66 19C65 22 62 24 62 24L66 28C67 30 68 33 66 36C64 39 60 40 56 40L14 40C10 40 8 38 7 36C6 34 8 30 8 30Z" fill="' +
      color +
      '" stroke="' +
      color +
      '" stroke-width="1.5" />' +
      '<path d="M12 38H58" stroke="rgba(0,0,0,.2)" stroke-width="2" stroke-linecap="round" />' +
      '<circle cx="30" cy="12" r="1.5" fill="rgba(0,0,0,.15)" /><circle cx="36" cy="11" r="1.5" fill="rgba(0,0,0,.15)" /><circle cx="42" cy="12" r="1.5" fill="rgba(0,0,0,.15)" />' +
      '<line x1="0" y1="18" x2="-10" y2="18" stroke="' +
      color +
      '" stroke-width="1.5" stroke-linecap="round" opacity=".6" />' +
      '<line x1="2" y1="24" x2="-12" y2="24" stroke="' +
      color +
      '" stroke-width="1.5" stroke-linecap="round" opacity=".4" />' +
      '<line x1="1" y1="30" x2="-8" y2="31" stroke="' +
      color +
      '" stroke-width="1.5" stroke-linecap="round" opacity=".5" /></svg>'
    );
  }

  function create(container, options) {
    if (!container) throw new Error('container is required');
    ensureStyles();

    var cfg = Object.assign({}, DEFAULTS, options || {});
    container.innerHTML = '';

    var wrap = document.createElement('div');
    wrap.className = 'wrc-logo-wrap';
    wrap.style.background = cfg.backgroundColor;

    var stage = document.createElement('div');
    stage.className = 'wrc-stage';
    stage.style.width = cfg.width + 'px';
    stage.style.height = cfg.height + 'px';

    var baseSvg = document.createElement('div');
    baseSvg.innerHTML = buildSvg(cfg);
    var svg = baseSvg.firstChild;

    var slices = document.createElement('div');
    var originalMarkup = svg.outerHTML;

    for (var i = 0; i < cfg.sliceCount; i++) {
      var pctTop = (i / cfg.sliceCount) * 100;
      var pctBot = ((cfg.sliceCount - 1 - i) / cfg.sliceCount) * 100;
      var slice = document.createElement('div');
      slice.className = 'wrc-blind-slice';
      slice.style.clipPath = 'inset(' + pctTop + '% 100% ' + pctBot + '% 0%)';
      slice.style.transition = 'clip-path 0.5s ' + i * 0.06 + 's cubic-bezier(0.22,1,0.36,1)';
      slice.innerHTML = originalMarkup;
      slice.querySelectorAll('.wrc-star-icon').forEach(function (s) {
        s.style.visibility = 'hidden';
      });
      slices.appendChild(slice);
    }

    var shoe = document.createElement('div');
    shoe.className = 'wrc-shoe-runner';
    shoe.innerHTML = buildShoe(cfg.shoeColor);

    svg.style.opacity = '0';
    stage.appendChild(svg);
    stage.appendChild(slices);
    stage.appendChild(shoe);
    wrap.appendChild(stage);
    container.appendChild(wrap);

    var played = false;

    function revealBlinds() {
      var nodeList = slices.querySelectorAll('.wrc-blind-slice');
      nodeList.forEach(function (div, i) {
        var pctTop = (i / cfg.sliceCount) * 100;
        var pctBot = ((cfg.sliceCount - 1 - i) / cfg.sliceCount) * 100;
        setTimeout(function () {
          div.style.clipPath = 'inset(' + pctTop + '% 0% ' + pctBot + '% 0%)';
        }, i * 60);
      });
    }

    function triggerShoe() {
      shoe.classList.remove('running');
      void shoe.offsetWidth;
      shoe.classList.add('running');
    }

    function punchStars() {
      var order = [['wrc-star1', 'wrc-star5'], ['wrc-star2', 'wrc-star4'], ['wrc-star3']];
      order.forEach(function (group, gi) {
        setTimeout(function () {
          group.forEach(function (id) {
            slices.querySelectorAll('#' + id).forEach(function (el) {
              el.style.visibility = 'visible';
              el.classList.add('punched');
            });
          });
        }, gi * 200);
      });
    }

    function play() {
      if (played && !cfg.replayOnVisible) return;
      played = true;
      revealBlinds();
      setTimeout(triggerShoe, 420);
      setTimeout(punchStars, 1150);
    }

    if (cfg.autoPlay) {
      if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              if (entry.isIntersecting) {
                play();
                if (!cfg.replayOnVisible) observer.disconnect();
              }
            });
          },
          { threshold: 0.4 }
        );
        observer.observe(stage);
      } else {
        play();
      }
    }

    function update(nextOptions) {
      cfg = Object.assign({}, cfg, nextOptions || {});
      create(container, cfg);
    }

    return {
      play: play,
      update: update,
      destroy: function () {
        container.innerHTML = '';
      }
    };
  }

  return {
    create: create,
    defaults: DEFAULTS
  };
});
