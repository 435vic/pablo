import {
  SlashCommandPartial,
  SlashCommandOptionType,
} from "@harmony/harmony";

export const commands: SlashCommandPartial[] = [
  {
    name: 'link',
    description: "Link your Discord account to Minecraft. See instructions in #how-to-join!",
    options: [
      {
        name: 'code',
        description: "8 character code, given to you by Minecraft. format: (XXXX-XXXX)",
        type: SlashCommandOptionType.STRING,
        required: true
      }
    ]
  }
];

