### 面板问题还原助手(RestoreHelper)

- 适用范围

  - 开发
    - 有时存在 debug 模式下和非 debug 模式下，表现不一致，由于看不到日志或打不了断点，这时就不是很好排查什么原因
  - 测试
    - 测试中经常出现一些问题，但是我们本地却看起正常，app 的日志是针对于 app 端同学的，我们排期起来很费力。这时可以让测试将面板自己的日志分享出来，加快问题定位
  - 线上面板? 待定
    - 同测试场景

- 功能

  - 日志记录
  - 支持通过 app 分享日志

- 使用方式

```ts
// main.js
import RestoreHelper, { utils, restore } from '@components/RestoreHelper';
// 运行监测
restore.run();

// TSX
const [showHelp, setShowHelp] = React.useState(false);
const handleHide = () => {
  setShowHelp(false);
};

<View
  {...utils.changeVisibility(setShowHelp).panHandlers}
  style={{
    height: '100%',
    width: '100%',
  }}
>
  <Comp {...props} />
  {showHelp && <RestoreHelper onHide={handleHide} />}
</View>;
```
