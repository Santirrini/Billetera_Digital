import { Link } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import { Platform } from 'react-native';
import { a11yLink } from '@/utils/a11y';

export function ExternalLink(
  props: Omit<React.ComponentProps<typeof Link>, 'href'> & {
    href: string;
    accessibilityLabel?: string;
    accessibilityHint?: string;
  },
) {
  const { accessibilityLabel, accessibilityHint, ...rest } = props;
  const a11y = a11yLink(accessibilityLabel || rest.href, accessibilityHint);
  return (
    <Link
      target="_blank"
      {...rest}
      {...a11y}
      href={props.href as any}
      onPress={(e) => {
        if (Platform.OS !== 'web') {
          e.preventDefault();
          WebBrowser.openBrowserAsync(props.href as string);
        }
      }}
    />
  );
}
