import { Embed } from "@harmony/harmony";

export const PIK_LOGO =
  "https://files.boredvico.dev/mc/pichulanordica.png?k=MVq-BSwg";

export function success(message: string): Embed {
  return new Embed({
    author: {
      name: "Success",
      icon_url: PIK_LOGO,
    },
    description: message,
    color: 0x66e37b,
  });
}

export function error(message: string): Embed {
  return new Embed({
    author: {
      name: "Error",
      icon_url: PIK_LOGO,
    },
    description: message,
    color: 0xe36666,
  });
}
