# WRC Run Club Animated Embed Package

A framework-agnostic deliverable you can ship into unknown host stacks.

## What is included

- `dist/wrc-runclub-embed.umd.js`: standalone UMD bundle (works via `<script>` tag, CommonJS, and browser global).
- `react/WrcRunClubLogo.jsx`: optional React wrapper component for apps already on React.

## Vanilla JS install (stack-agnostic)

```html
<div id="wrc-logo" style="width:420px;height:340px"></div>
<script src="./dist/wrc-runclub-embed.umd.js"></script>
<script>
  const instance = window.WrcRunClubEmbed.create(document.getElementById('wrc-logo'), {
    clubName: 'WRC',
    textColor: '#fff',
    starColor: '#fff',
    backgroundColor: 'transparent',
    autoPlay: true
  });

  // optional
  // instance.play();
</script>
```

## React install

```jsx
import WrcRunClubLogo from './react/WrcRunClubLogo';

export default function Hero() {
  return (
    <WrcRunClubLogo
      clubName="WRC"
      width={420}
      height={340}
      textColor="#ffffff"
      starColor="#ffffff"
      shoeColor="#ffffff"
      fontSize={180}
      autoPlay
    />
  );
}
```

## API

`WrcRunClubEmbed.create(container, options)` returns:
- `play()` - run animation sequence.
- `update(nextOptions)` - rebuild with new values.
- `destroy()` - teardown.

### options
- `clubName` (string, default `WRC`)
- `width` (number, default `420`)
- `height` (number, default `340`)
- `backgroundColor` (string, default `transparent`)
- `textColor` (string, default `#FFFFFF`)
- `starColor` (string, default `#FFFFFF`)
- `shoeColor` (string, default `#FFFFFF`)
- `fontFamily` (string, default `'Bebas Neue', sans-serif`)
- `fontSize` (number, default `180`)
- `sliceCount` (number, default `12`)
- `autoPlay` (boolean, default `true`)
- `replayOnVisible` (boolean, default `false`)

## Notes

- No Tailwind dependency.
- No external SDK dependency.
- Drop-in compatible for unknown host app stacks.
