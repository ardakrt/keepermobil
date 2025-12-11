import * as React from "react";
import Svg, { Rect, Path, Circle } from "react-native-svg";

const AppLogo = (props) => (
  <Svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 32 32"
    fill="none"
    {...props}
  >
    <Rect width={32} height={32} fill="#000000" />
    <Path
      d="M7 4C6.44772 4 6 4.44772 6 5V27C6 27.5523 6.44772 28 7 28H11C11.5523 28 12 27.5523 12 27V19L19.2929 27.2929C19.6834 27.6834 20.3166 27.6834 20.7071 27.2929L26.2929 21.7071C26.9229 21.0771 26.4767 20 25.5858 20H18L12 14V5C12 4.44772 11.5523 4 11 4H7Z"
      fill="#ffffff"
    />
    <Path d="M19.5 4L13.5 11.5L19.5 4Z" fill="#ffffff" />
    <Path d="M12 14.5L20 4.5H27L17 16L12 14.5Z" fill="#ffffff" />
    <Circle cx={27} cy={26} r={3.5} fill="#10b981" />
  </Svg>
);

export default AppLogo;
