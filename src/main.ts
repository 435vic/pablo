import {
  ApplicationCommandInteraction,
  Channel,
  Client,
  Embed,
  event,
  GatewayIntents,
  Guild,
  GuildChannel,
  GuildTextChannel,
  Interaction,
  Message,
  MessageComponentType,
  slash,
} from "@harmony/harmony";
import { commands } from "@/commands.ts";
import "@/pik.ts"; // trigger healthcheck
import { routes, makeStatsTask } from "./pik.ts";
import { error, PIK_LOGO, success } from "./embeds.ts";
import db from "./db.ts";

export class Pablo extends Client {
  pikChannelId: string;
  pikStatusChannelId: string;
  // Channel that shows server status (non-joinable voice channel)
  pikStatusChannel?: GuildChannel;
  // Channel for minecraft chat, messages sent here are sent to MC
  pikChannel?: GuildTextChannel;
  guildId: string;
  guild?: Guild;
  
  mcStatsInterval: number;

  constructor(gid: string, pikcid: string, pikStatusCid: string) {
    super();
    this.guildId = gid;
    this.pikChannelId = pikcid;
    this.pikStatusChannelId = pikStatusCid;
    this.mcStatsInterval = 0;
  }

  @event()
  async ready() {
    console.log(`Logged in as ${this.user?.tag}`);
    this.guild = await this.guilds.get(this.guildId);
    if (!this.guild) {
      console.error(
        `Guild ${this.guildId} not accessible or does not exist. Cannot continue.`,
      );
      Deno.exit(1);
    }

    this.pikStatusChannel = await this.guild.channels.get(this.pikStatusChannelId);
    if (!this.pikStatusChannel) {
      console.warn(`Could not obtain status channel ${this.pikStatusChannelId}`);
    }

    this.pikChannel = await this.guild.channels.get(this.pikChannelId)
      .then(c => {
        if (!c?.isGuildText()) {
          throw Error(`PIK main channel ID doesn't exist or\
points to a non-text channel. Please provide an ID for a text channel.`)
        }
        return c
      });
    if (!this.pikChannel) {
      console.warn(`Could not obtain main channel ${this.pikChannelId}`);
    }

    const currentCommands = await this.guild!.commands.all();
    if (
      currentCommands.size !== commands.length ||
      (Deno.env.get("PABLO_UPDATE_COMMANDS") ?? "0") === "1"
    ) {
      console.log("updating commands...");
      await this.interactions.commands.bulkEdit(commands);
    }

    this.mcStatsInterval = setInterval(makeStatsTask(async stats => {
      console.log("[pik] fetched stats from mc:", stats);
      const message = stats.online
        ? `🟢 Players: ${stats.playerCount}`
        : "🔴 Offline";
      
      try {
        await this.pikStatusChannel?.setName(message);
        await this.pikChannel?.setTopic(`Chat with people on the server!\n${this.printPlayers(stats.players)}`); 
      } catch (e) {
        console.error(`Unable to update discord channel`, e);
      }
    }), 60_000);
  }

  @slash()
  async link(i: ApplicationCommandInteraction) {
    const codeParam = i.options.find((o) => o.name === "code")?.value as string;
    const cleanedCode = codeParam.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleanedCode.length != 8) {
      await i.reply({
        embeds: [
          error(
            "Invalid code. Make sure it's in the format XXXX-XXXX (8 characters)",
          ),
        ],
        ephemeral: true,
        components: []
      });
      return;
    }

    const code = `${cleanedCode.substring(0, 4)}-${cleanedCode.substring(4)}`;
    const res = await routes.otp.verify(code);
    if (!res) {
      await i.reply({
        embeds: [
          error(
            "Code invalid or incorrect. Try connecting to the Minecraft server to get a new code.",
          ),
        ],
        ephemeral: true,
        components: []
      });
      return;
    }

    await i.reply({
      embeds: [
        new Embed({
          author: {
            name: "Confirm linking",
            icon_url: PIK_LOGO,
          },
          description:
            `Are you sure you want to link your account to \`${res.name}\`?`,
        }),
      ],
      ephemeral: true,
      components: [
        {
          type: MessageComponentType.ACTION_ROW,
          components: [
            {
              type: MessageComponentType.BUTTON,
              style: "SUCCESS",
              label: "Confirm",
              customID: `confirm-link:${res.uuid}:${res.name}`,
            },
            {
              type: MessageComponentType.BUTTON,
              style: "DANGER",
              label: "Cancel",
              customID: "cancel-link",
            },
          ],
        },
      ],
    });
  }

  @event("interactionCreate")
  async onInteraction(i: Interaction) {
    if (!i.isMessageComponent()) return;
    if (!i.customID.includes("link")) return;

    if (i.customID === "cancel-link") {
      await i.updateMessage({
        embeds: [success("Account linking cancelled.")],
        components: [],
      });
      return;
    }

    const [,uuid,player] = i.customID.split(":");
    console.log(`attemting to add user ${player}`);
    const whitelistRes = await routes.whitelist.add(player);
    console.log(`server respondend`, whitelistRes);
    if (!whitelistRes.ok) {
      console.error(
        `could not whitelist, ${whitelistRes.status} ${whitelistRes.statusText}`,
      );
      await i.updateMessage({
        embeds: [
          error(
            "Unable to add you to the whitelist. Server may be down or malfunctioning. Try again later :/",
          ),
        ],
        components: [],
      });
      return;
    }

    console.info(`Linking ${i.user.id} <-> ${uuid}`);
    db.prepare("INSERT INTO linked_users (did, mcid) VALUES (?, ?)").run(i.user.id, uuid);
    await i.updateMessage({
      embeds: [success("You have been ~~promoted~~ whitelisted!")],
      components: [],
    });
  }

  @event("messageCreate")
  async onMessage(msg: Message) {
    if (msg.channelID != this.pikChannelId) return;
    // message from minecraft
    if (msg.webhookID) return;

    if (!msg.content?.length) {
      console.error(
        "Message has no content. Privileged intent may not be enabled.",
      );
      return;
    }

    const res = await routes.chat({
      author: msg.author.username,
      content: msg.content,
    });
    return res;
  }

  printPlayers(players: string[]) {
    if (!players.length) {
      return "Currently there are no players online.";
    }

    return `Online: ${players.join(", ")}`;
  }
}

type SnakeToCamel<S extends string> = 
  S extends `${infer First}_${infer Rest}`
    ? `${Lowercase<First>}${Capitalize<SnakeToCamel<Rest>>}`
    : Lowercase<S>;

type PrefixedEnvKey<S extends string> =
  S extends `${infer _}_${infer Rest}`
    ? SnakeToCamel<Rest>
    : SnakeToCamel<S>

type EnvObject<T extends readonly string[]> = {
  [K in T[number] as PrefixedEnvKey<K>]: string;
};

function ensureEnv<T extends readonly string[]>(...vars: T): EnvObject<T> {
  // deno-lint-ignore no-explicit-any
  const out = {} as any;
  for (const varName of vars) {
    const envVar = Deno.env.get(varName);
    if (!envVar) {
      console.error(`${varName} must be set!`);
      Deno.exit(1);
    }
    
    const keyName = varName
      .toLowerCase()
      .replace(/[a-z]+_/, '')
      .replace(/_([a-z])/g, (_, c) => c.toUpperCase());

    out[keyName] = envVar;
  }

  return out;
}

if (import.meta.main) {
  const env = ensureEnv(
    "PABLO_BOT_TOKEN",
    "PABLO_GUILD_ID",
    "PIK_CHANNEL_ID",
    "PIK_STATUS_CHANNEL_ID",
  ); 

  console.log('Obtained env vars:', env);

  const client = new Pablo(env.guildId, env.channelId, env.statusChannelId);

  client.connect(env.botToken, [
    GatewayIntents.GUILD_MESSAGES,
    GatewayIntents.GUILDS,
    GatewayIntents.MESSAGE_CONTENT,
  ]);
}
