// 自定义 react-big-calendar 时间视图布局算法。
//
// 背景：默认的 'no-overlap' 算法会在并排显示的事件之间留出 3px 的水平间距
//   （node_modules/react-big-calendar/lib/utils/layout-algorithms/no-overlap.js
//     line 91-94：
//       var padding = e.idx === 0 ? 0 : 3;
//       e.style.width   = "calc(N% - 3px)";
//       e.style.xOffset = "calc(M% + 3px)";
//   ）
// 这会让同一时间段内左右并排的事件块之间出现一条白色缝隙，破坏视觉上的紧密贴合。
//
// 这里复用官方 'no-overlap' 的输出，将 width / xOffset 中的水平 padding
// 从 3px 收紧到 1px（"- 3px" → "- 1px","+ 3px" → "+ 1px"），
// 让相邻事件之间仅保留极细的 1px 缝隙，既贴合又能区分边界。
// 注意：不修改 height（保留默认的 "calc(N% - 2px)"），因此竖直方向上仍保持
// 默认布局行为。
//
import noOverlapModule from 'react-big-calendar/lib/utils/layout-algorithms/no-overlap';

type StyledEvent = {
  event: unknown;
  style: {
    top: number | string;
    height: number | string;
    width: number | string;
    xOffset: number | string;
  };
  [key: string]: unknown;
};

type AlgorithmArgs = unknown;
type AlgorithmFn = (args: AlgorithmArgs) => StyledEvent[];

const baseAlgorithm: AlgorithmFn =
  // 兼容 ESM/CJS 默认导出
  (noOverlapModule as {default?: AlgorithmFn}).default ?? (noOverlapModule as AlgorithmFn);

// 仅匹配 no-overlap 自身生成的 calc(...) 表达式，确保不会误改其它内联样式。
const WIDTH_GAP_REGEX = /^calc\(\s*([\d.]+)%\s*-\s*\d+(?:\.\d+)?px\s*\)$/;
const XOFFSET_GAP_REGEX = /^calc\(\s*([\d.]+)%\s*\+\s*\d+(?:\.\d+)?px\s*\)$/;

const stripHorizontalGap = (value: number | string, regex: RegExp): number | string => {
  if (typeof value !== 'string') return value;
  const match = value.match(regex);
  if (!match) return value;
  const percent = match[1];
  return regex === WIDTH_GAP_REGEX
    ? `calc(${percent}% - 1px)`
    : `calc(${percent}% + 1px)`;
};

/**
 * 与 'no-overlap' 行为一致，但将并排事件之间的水平间距从 3px 收紧到 1px，
 * 让相邻事件块在 X 方向上仅保留极细的视觉分隔。
 */
export default function noOverlapNoHorizontalGap(args: AlgorithmArgs): StyledEvent[] {
  const styled = baseAlgorithm(args);
  return styled.map((entry) => {
    if (!entry.style) return entry;
    const nextWidth = stripHorizontalGap(entry.style.width, WIDTH_GAP_REGEX);
    const nextXOffset = stripHorizontalGap(entry.style.xOffset, XOFFSET_GAP_REGEX);
    if (nextWidth === entry.style.width && nextXOffset === entry.style.xOffset) {
      return entry;
    }
    return {
      ...entry,
      style: {
        ...entry.style,
        width: nextWidth,
        xOffset: nextXOffset,
      },
    };
  });
}
