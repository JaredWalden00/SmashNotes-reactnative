import { Image, Pressable, StyleSheet, Text, View } from "react-native";

export default function FighterTile({ fighter, count, selected = false, compact = false, onPress }) {
  return (
    <Pressable
      style={[styles.tile, compact ? styles.tileCompact : styles.tileRegular, selected && styles.tileSelected]}
      onPress={() => onPress(fighter.name)}
    >
      <Image source={fighter.icon} style={compact ? styles.iconCompact : styles.iconRegular} />
      <Text style={styles.name} numberOfLines={2}>
        {fighter.name}
      </Text>
      {count ? (
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DEE4EF",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  tileRegular: {
    width: "23%",
    minWidth: 74,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  tileCompact: {
    width: "23%",
    minWidth: 70,
    paddingVertical: 10,
    paddingHorizontal: 6,
    marginBottom: 10,
  },
  tileSelected: {
    borderColor: "#FF6B3D",
    backgroundColor: "#FFF3EE",
  },
  iconRegular: {
    width: 52,
    height: 52,
    marginBottom: 8,
  },
  iconCompact: {
    width: 42,
    height: 42,
    marginBottom: 6,
  },
  name: {
    fontSize: 11,
    fontWeight: "700",
    color: "#20304E",
    textAlign: "center",
    minHeight: 28,
  },
  badge: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    paddingHorizontal: 4,
    backgroundColor: "#20304E",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeLabel: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
});