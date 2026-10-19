import type {ClassData, ConstructorData, MethodData} from "../types/classData";

export interface SearchEntry {
    type: string;
    name: string;
    owner?: string;
    packageName?: string;
    description: string;
    kind: "native" | "class" | "event" | "method" | "static-method" | "constructor" | "constant";
    lowerName: string;
    lowerType: string;
    lowerDescription: string;
    words: string[];
    packageRank: number;
}

export interface SearchLookup {
    getClass(name: string): ClassData | null | undefined;
    getMethod(owner: string, signature: string): MethodData | null | undefined;
    getConstructor(owner: string, signature: string): ConstructorData | null | undefined;
    getTitle(type: string): string | undefined;
}

export const aliases: Record<string, string[]> = {
    welcome: ["org.bukkit.event.player.PlayerJoinEvent"],
    join: ["org.bukkit.event.player.PlayerJoinEvent"],
    quit: ["org.bukkit.event.player.PlayerQuitEvent"],
    leave: ["org.bukkit.event.player.PlayerQuitEvent"],
    chat: ["io.papermc.paper.event.player.AsyncChatEvent"],
    break: ["org.bukkit.event.block.BlockBreakEvent"],
    mine: ["org.bukkit.event.block.BlockBreakEvent"],
    place: ["org.bukkit.event.block.BlockPlaceEvent"],
    death: ["org.bukkit.event.entity.PlayerDeathEvent", "org.bukkit.event.entity.EntityDeathEvent"],
    respawn: ["org.bukkit.event.player.PlayerRespawnEvent"],
    damage: ["org.bukkit.event.entity.EntityDamageEvent"],
    give: ["org.bukkit.inventory.Inventory#addItem(org.bukkit.inventory.ItemStack...)"],
    item: ["org.bukkit.inventory.ItemStack", "org.bukkit.inventory.ItemStack#ItemStack(org.bukkit.Material, int)"],
    spawn: ["org.bukkit.RegionAccessor#spawnEntity(org.bukkit.Location, org.bukkit.entity.EntityType)"],
    teleport: ["org.bukkit.entity.Entity#teleport(org.bukkit.Location)"],
    message: ["org.bukkit.command.CommandSender#sendRichMessage(java.lang.String)", "org.bukkit.command.CommandSender#sendMessage(java.lang.String)"],
    send: ["org.bukkit.command.CommandSender#sendRichMessage(java.lang.String)", "org.bukkit.command.CommandSender#sendMessage(java.lang.String)"],
    broadcast: ["org.bukkit.Bukkit#broadcast(net.kyori.adventure.text.Component)"],
    command: ["commands/Command"],
    config: ["config/ConfigValue", "config/ReloadConfig"],
    variable: ["variables/Set", "variables/Get"],
    log: ["native/ConsoleLog"],
    timer: ["org.bukkit.scheduler.BukkitScheduler#runTaskTimer(org.bukkit.plugin.Plugin, java.lang.Runnable, long, long)"],
    delay: ["org.bukkit.scheduler.BukkitScheduler#runTaskLater(org.bukkit.plugin.Plugin, java.lang.Runnable, long)"]
};

export function firstSentence(comment?: string): string {
    const text = (comment || "")
        .replace(/\{@(?:link|code)\s+([^}]+)\}/g, (_, reference: string) => {
            const [target] = reference.trim().split(/\s+/);
            const [owner, member] = target.split("#");
            const simpleName = owner.slice(owner.lastIndexOf(".") + 1);
            return member ? simpleName + "." + member : simpleName;
        })
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim();
    const end = text.search(/\. [A-Z]/);
    return (end === -1 ? text : text.slice(0, end + 1)).slice(0, 120);
}

export function buildSearchEntries(types: string[], lookup: SearchLookup): SearchEntry[] {
    const entries: SearchEntry[] = [];
    for (const type of types) {
        if (type.includes("{")) continue;
        let name: string;
        let description = "";
        let owner: string | undefined;
        let packageName: string | undefined;
        let kind: SearchEntry["kind"];
        if (type.includes("/")) {
            name = lookup.getTitle(type) || type.slice(type.lastIndexOf("/") + 1);
            packageName = type.slice(0, type.lastIndexOf("/"));
            kind = "native";
        } else {
            const separator = type.indexOf("#");
            const className = separator === -1 ? type : type.slice(0, separator);
            const clazz = lookup.getClass(className);
            if (!clazz || clazz.isDeprecated) continue;
            owner = clazz.simpleName;
            packageName = clazz.package;
            const signature = type.slice(separator + 1);
            if (separator === -1) {
                name = clazz.simpleName;
                description = firstSentence(clazz.comment);
                kind = clazz.isEvent ? "event" : "class";
            } else if (signature.startsWith("static:")) {
                const fieldType = signature.slice("static:".length);
                const fields = Object.values(clazz.fieldsByName).filter(field =>
                    field.isStatic && !field.isDeprecated && field.type.qualifiedName === fieldType);
                if (!fields.length) continue;
                name = clazz.simpleName + (fieldType === className ? "" : ": " + fields[0].type.simpleName);
                description = firstSentence(fields[0].comment);
                kind = "constant";
            } else {
                const method = lookup.getMethod(className, signature);
                const constructor = method ? undefined : lookup.getConstructor(className, signature);
                const member = method || constructor;
                if (!member || member.isDeprecated) continue;
                name = method ? clazz.simpleName + "." + method.fullFlatSignature : member.fullFlatSignature;
                description = firstSentence(member.comment);
                kind = method ? (method.isStatic ? "static-method" : "method") : "constructor";
            }
        }
        entries.push({
            type, name: name + (kind === "constant" ? " (constant)" : ""), owner, packageName, description, kind,
            lowerName: name.toLowerCase(),
            lowerType: type.toLowerCase(),
            lowerDescription: description.toLowerCase(),
            words: name.split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])|[^A-Za-z0-9]+/).map(word => word.toLowerCase()),
            packageRank: /^(org\.bukkit|io\.papermc|net\.kyori)(\.|$)/.test(packageName || "") ? 0 : packageName?.startsWith("java.") ? 1 : 2
        });
    }
    return entries;
}

const kindRank = {event: 0, class: 1, constant: 2, constructor: 3, method: 4, "static-method": 4, native: 5};

export function searchNodes(entries: SearchEntry[], query: string, limit = 50): SearchEntry[] {
    const words = query.trim().toLowerCase().split(/\s+/);
    const first = words[0];
    const keyword = words.join(" ");
    const targets = new Set(Object.hasOwn(aliases, keyword) ? aliases[keyword] : []);
    const matches: {entry: SearchEntry; tier: number}[] = [];
    for (const entry of entries) {
        const alias = targets.has(entry.type);
        if (!alias && !words.every(word => entry.lowerName.includes(word) || entry.lowerType.includes(word) ||
            (word.length >= 3 && entry.lowerDescription.includes(word)))) continue;
        let tier = 5;
        if (alias) tier = 0;
        else if (entry.lowerName === first || entry.lowerType === first) tier = 1;
        else if (entry.lowerName.startsWith(first)) tier = 2;
        else if (entry.words.some(word => word.startsWith(first))) tier = 3;
        else if (entry.lowerName.includes(first) || entry.lowerType.includes(first)) tier = 4;
        matches.push({entry, tier});
    }
    matches.sort((a, b) => a.tier - b.tier || kindRank[a.entry.kind] - kindRank[b.entry.kind] ||
        a.entry.packageRank - b.entry.packageRank || a.entry.name.length - b.entry.name.length ||
        a.entry.lowerName.localeCompare(b.entry.lowerName) || a.entry.type.localeCompare(b.entry.type));
    return matches.slice(0, limit).map(match => match.entry);
}
