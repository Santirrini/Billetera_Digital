import { Text as DefaultText, View as DefaultView, TextProps as RNTextProps, ViewProps as RNViewProps } from 'react-native';

import { useColors } from '@/constants/Colors';

type ThemeProps = {
  lightColor?: string;
  darkColor?: string;
};

export type TextProps = ThemeProps & RNTextProps;
export type ViewProps = ThemeProps & RNViewProps;

export function Text(props: TextProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const COLORS = useColors();
  const color = lightColor || darkColor || COLORS.text;
  return (
    <DefaultText
      style={[{ color }, style]}
      allowFontScaling
      maxFontSizeMultiplier={1.6}
      {...otherProps}
    />
  );
}

export function View(props: ViewProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const COLORS = useColors();
  const backgroundColor = lightColor || darkColor || COLORS.bg;
  return <DefaultView style={[{ backgroundColor }, style]} {...otherProps} />;
}
