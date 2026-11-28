"""Crop colours for the toy-diorama look in GAME_ART.md.

Generated crops are not Blender assets: the plant generator builds them in
code from the presets in `packages/game/src/generators/plant`. Their colours
still follow the same rule as every model, so this script holds the on-screen
target for every crop colour role and converts it to the albedo the presets
use, with the same sunlit gain and neutral tone mapping as `party_style.py`.

Targets that tone mapping cannot reach (bright, very saturated oranges and
yellows) fall back to the reachable albedo whose on-screen colour is closest
in Oklab. The report printed by the script lists each role with the colour it
actually shows, so a fallback is visible.

Run with plain Python from the repository root. It rewrites the generated
palette module and is safe to run again:

    python3 assets/scripts/party-pass-crops.py
    (cd packages/game && npx biome check --write \
        src/generators/plant/lib/cropPalette.ts)

Pass `--check` to print the report without writing.
"""

import argparse
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import party_style  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
OUTPUT = REPO / "packages/game/src/generators/plant/lib/cropPalette.ts"


def role(name):
    """On-screen colour of a shared role in party_style (GAME_ART.md)."""
    roles = {**party_style.SCREEN_ROLES, **getattr(party_style, "SEASONAL_ROLES", {})}
    return roles[name][0]


# On-screen colour of a sunlit top face for every crop colour role.
# Leaves start from the crop leaf roles in GAME_ART.md (#5fc93a base,
# #a4e352 highlight). Species keep a small, readable shift: brassicas lean
# cool, olive and artichoke are silvery, salad leaves are light.
LEAF = {
    "base": role("crop_leaf"),
    "highlight": role("crop_leaf_light"),
    "light": "#80d646",  # between base and highlight: herbs, alliums
    "pale": role("crop_leaf_light"),  # salad leaves: lettuce, lamb's lettuce
    "brassica": "#5cc46e",  # cool blue-green of cabbage and kale
    "silver": "#9fd27c",  # olive, artichoke, thyme
    "senescent": "#d8b45c",  # a dying leaf turns straw yellow
}

STEM = {
    "base": "#8fd448",  # a lighter, warmer green than the leaves
    "pale": "#b6e68a",  # celery, fennel
    "beet": "#d9416b",  # red beet stalks
    "chard": "#ef7d4c",  # coral chard stalks
    "wood": role("trunk"),  # woody shrubs and trees
    # Bark marks on woody stems, about 15% darker than the trunk role.
    "woodDetail": "#9c5b34",
}

FLOWER = {
    "yellow": role("petal_yellow"),
    "cream": "#fbeec8",  # warm neutral for white petals
    "lilac": "#b98ef0",
    "blush": "#f6cfe2",  # apple blossom
}

THORN = {"wood": "#c98a52"}

# Produce: (ripe colour, unripe colour or None, roughness band).
PRODUCE = {
    "strawberry": (role("ripe_red"), "#d6ec8a", 0.35),
    "blueberry": ("#5a7ae6", "#b9e07a", 0.45),
    "raspberry": ("#f03a6a", "#d6ec8a", 0.45),
    "tomato": (role("ripe_red"), "#b8e35a", 0.25),
    "cucumber": ("#4fb847", None, 0.4),
    "bellpepper": (role("ripe_red"), "#58c23c", 0.25),
    "carrot": (role("carrot_orange"), None, 0.4),
    "onion": ("#eab25e", None, 0.5),
    "eggplant": ("#7b3fb5", "#c6e07a", 0.25),
    # Zucchini and broccoli are the darkest produce; they stay at value 0.7
    # and lean cooler than cucumber instead of darker.
    "zucchini": ("#3bb359", None, 0.35),
    # The same pumpkin as the harvest collection, so a grown pumpkin matches
    # the decorative ones.
    "pumpkin": (role("pumpkin"), "#8fd046", 0.4),
    "melon": ("#d9e67a", None, 0.5),
    "beet": ("#d42f62", None, 0.45),
    "radish": ("#f2405c", None, 0.35),
    "turnip": ("#f4ebcf", None, 0.5),
    "garlic": ("#f3ead6", None, 0.6),
    "leek": ("#def0b0", None, 0.5),
    "broccoli": ("#3fb36b", None, 0.6),
    "cauliflower": ("#f6edcd", None, 0.6),
    "cabbage": ("#a8dc6a", None, 0.5),
    "beanpod": ("#7fd24a", None, 0.45),
    "peapod": ("#95dc55", None, 0.45),
    "artichoke": ("#90c46f", None, 0.55),
    "okra": ("#86cf4f", None, 0.45),
    "fennel": ("#e2f0b3", None, 0.5),
    "kohlrabi": ("#b8e57a", None, 0.45),
}


# ------------------------------------------------------------------ colour
def linear_to_oklab(color):
    r, g, b = color
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l, m, s = (math.copysign(abs(v) ** (1 / 3), v) for v in (l, m, s))
    return (
        0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    )


def shown_linear(albedo):
    return party_style.neutral_tone_map(
        [party_style.SUNLIT_GAIN * channel for channel in albedo]
    )


def oklab_error(albedo, target_lab):
    shown = [min(1.0, max(0.0, c)) for c in shown_linear(albedo)]
    lab = linear_to_oklab(shown)
    return math.dist(lab, target_lab)


def solve_albedo(target_hex):
    """Albedo that shows `target_hex`, or the closest reachable colour."""
    albedo = list(party_style.screen_to_albedo(target_hex))
    target_lab = linear_to_oklab(party_style.hex_to_linear(target_hex))
    error = oklab_error(albedo, target_lab)
    step = 0.05
    while step > 1e-5:
        improved = False
        for channel in range(3):
            for direction in (-1, 1):
                candidate = list(albedo)
                candidate[channel] = min(
                    1.0, max(0.0, candidate[channel] + direction * step)
                )
                candidate_error = oklab_error(candidate, target_lab)
                if candidate_error < error - 1e-9:
                    albedo, error, improved = candidate, candidate_error, True
        if not improved:
            step /= 2
    return albedo, error


def hsv(hex_value):
    r, g, b = (int(hex_value[i : i + 2], 16) / 255 for i in (1, 3, 5))
    high, low = max(r, g, b), min(r, g, b)
    delta = high - low
    if delta == 0:
        hue = 0.0
    elif high == r:
        hue = 60 * (((g - b) / delta) % 6)
    elif high == g:
        hue = 60 * ((b - r) / delta + 2)
    else:
        hue = 60 * ((r - g) / delta + 4)
    return round(hue), round(delta / high if high else 0, 2), round(high, 2)


def entry(target_hex):
    albedo, error = solve_albedo(target_hex)
    albedo_hex = party_style.linear_to_hex(albedo)
    shown = party_style.albedo_to_screen(party_style.hex_to_linear(albedo_hex))
    return {
        "albedo": albedo_hex,
        "error": error,
        "shown": shown,
        "target": target_hex,
    }


# ------------------------------------------------------------------ output
def ts_group(name, roles, doc):
    lines = [f"/** {doc} */", f"export const {name} = {{"]
    for key, target in roles.items():
        value = entry(target)
        lines.append(
            f"    /** Shows {value['shown']} (target {target}). */\n"
            f"    {key}: '{value['albedo']}',"
        )
    lines.append("} as const;")
    return "\n".join(lines)


def ts_produce():
    lines = [
        "/** Produce albedo, unripe albedo and roughness band. */",
        "export const cropProducePalette = {",
    ]
    for produce, (ripe, unripe, roughness) in PRODUCE.items():
        ripe_entry = entry(ripe)
        fields = [f"color: '{ripe_entry['albedo']}'", f"roughness: {roughness}"]
        comment = f"Shows {ripe_entry['shown']} (target {ripe})"
        if unripe:
            unripe_entry = entry(unripe)
            fields.append(f"unripeColor: '{unripe_entry['albedo']}'")
            comment += f", unripe {unripe_entry['shown']} (target {unripe})"
        lines.append(f"    /** {comment}. */")
        lines.append(f"    {produce}: {{ {', '.join(fields)} }},")
    lines.append("} as const;")
    return "\n".join(lines)


def render_module():
    header = (
        "// Generated by assets/scripts/party-pass-crops.py. Do not edit by hand:\n"
        "// change the on-screen targets in that script and run it again.\n"
        "//\n"
        "// Albedo colours for generated crops. The scene lights a sunlit top face\n"
        "// to about 3.2 times its albedo before neutral tone mapping, so each value\n"
        "// is darker than the colour it shows. See GAME_ART.md, Colour.\n"
    )
    groups = [
        ts_group("cropLeafPalette", LEAF, "Leaf albedo by role."),
        ts_group("cropStemPalette", STEM, "Stem albedo by role."),
        ts_group("cropFlowerPalette", FLOWER, "Petal albedo by role."),
        ts_group("cropThornPalette", THORN, "Thorn albedo by role."),
        ts_produce(),
    ]
    return header + "\n" + "\n\n".join(groups) + "\n"


def report():
    rows = []
    for group, roles in (
        ("leaf", LEAF),
        ("stem", STEM),
        ("flower", FLOWER),
        ("thorn", THORN),
    ):
        for key, target in roles.items():
            rows.append((f"{group}.{key}", target))
    for produce, (ripe, unripe, _) in PRODUCE.items():
        rows.append((f"produce.{produce}", ripe))
        if unripe:
            rows.append((f"produce.{produce}.unripe", unripe))
    for name, target in rows:
        value = entry(target)
        flag = "  FALLBACK" if value["error"] > 0.01 else ""
        print(
            f"{name:28} target {target} {hsv(target)} -> albedo "
            f"{value['albedo']} shows {value['shown']} {hsv(value['shown'])}"
            f"{flag}"
        )


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    report()
    if args.check:
        return
    OUTPUT.write_text(render_module())
    print(f"wrote {OUTPUT.relative_to(REPO)}")


if __name__ == "__main__":
    main()
