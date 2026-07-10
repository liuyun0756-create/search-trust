import React from "react";
import { Document, G, Page, Path, Svg, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Report } from "@/types/database";

type ScoreCard = {
  label: string;
  value: string;
  description?: string;
  color: string;
};

const STATUS_COLORS: Record<string, string> = {
  High: "#22C55E",
  Strong: "#22C55E",
  Low: "#EF4444",
  Weak: "#EF4444",
  Medium: "#3B82F6",
  Moderate: "#8DBB16",
  "Medium-High": "#EF4444",
  "Medium-Low": "#F59E0B",
  Good: "#22C55E",
  Fair: "#F59E0B",
};

type IconName = "pageType" | "gbp" | "generated" | "reportId" | "trust" | "ranking" | "risk";

function PdfIcon({ name }: { name: IconName }) {
  const common = {
    strokeWidth: 1.66667,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };

  if (name === "pageType") {
    return (
      <Svg width={13} height={13} viewBox="0 0 20 20">
        <Path d="M4.99992 18.3334C4.55789 18.3334 4.13397 18.1578 3.82141 17.8453C3.50885 17.5327 3.33325 17.1088 3.33325 16.6668V3.33342C3.33325 2.89139 3.50885 2.46747 3.82141 2.15491C4.13397 1.84235 4.55789 1.66675 4.99992 1.66675H11.6666C11.9304 1.66632 12.1917 1.71809 12.4354 1.81906C12.6791 1.92003 12.9004 2.06822 13.0866 2.25508L16.0766 5.24508C16.264 5.43134 16.4126 5.65287 16.5138 5.89689C16.6151 6.1409 16.667 6.40256 16.6666 6.66675V16.6668C16.6666 17.1088 16.491 17.5327 16.1784 17.8453C15.8659 18.1578 15.4419 18.3334 14.9999 18.3334H4.99992Z" stroke="#2B7FFF" {...common} />
        <Path d="M11.6667 1.66675V5.83341C11.6667 6.05443 11.7545 6.26639 11.9108 6.42267C12.0671 6.57895 12.2791 6.66675 12.5001 6.66675H16.6667" stroke="#2B7FFF" {...common} />
        <Path d="M8.33341 7.5H6.66675" stroke="#2B7FFF" {...common} />
        <Path d="M13.3334 10.8333H6.66675" stroke="#2B7FFF" {...common} />
        <Path d="M13.3334 14.1667H6.66675" stroke="#2B7FFF" {...common} />
      </Svg>
    );
  }

  if (name === "gbp") {
    return (
      <Svg width={13} height={13} viewBox="0 0 20 20">
        <Path d="M7.50008 14.1666H5.83341C4.72835 14.1666 3.66854 13.7276 2.88714 12.9462C2.10573 12.1648 1.66675 11.105 1.66675 9.99992C1.66675 8.89485 2.10573 7.83504 2.88714 7.05364C3.66854 6.27224 4.72835 5.83325 5.83341 5.83325H7.50008" stroke="#00BC7D" {...common} />
        <Path d="M12.5 5.83325H14.1667C15.2717 5.83325 16.3315 6.27224 17.1129 7.05364C17.8943 7.83504 18.3333 8.89485 18.3333 9.99992C18.3333 11.105 17.8943 12.1648 17.1129 12.9462C16.3315 13.7276 15.2717 14.1666 14.1667 14.1666H12.5" stroke="#00BC7D" {...common} />
        <Path d="M6.66675 10H13.3334" stroke="#00BC7D" {...common} />
      </Svg>
    );
  }

  if (name === "generated") {
    return (
      <Svg width={13} height={13} viewBox="0 0 20 20">
        <Path d="M6.66675 1.66675V5.00008" stroke="#1A1F2B" {...common} />
        <Path d="M13.3333 1.66675V5.00008" stroke="#1A1F2B" {...common} />
        <Path d="M15.8333 3.33325H4.16667C3.24619 3.33325 2.5 4.07944 2.5 4.99992V16.6666C2.5 17.5871 3.24619 18.3333 4.16667 18.3333H15.8333C16.7538 18.3333 17.5 17.5871 17.5 16.6666V4.99992C17.5 4.07944 16.7538 3.33325 15.8333 3.33325Z" stroke="#1A1F2B" {...common} />
        <Path d="M2.5 8.33325H17.5" stroke="#1A1F2B" {...common} />
        <Path d="M6.66675 11.6667H6.67508" stroke="#1A1F2B" {...common} />
        <Path d="M10 11.6667H10.0083" stroke="#1A1F2B" {...common} />
        <Path d="M13.3333 11.6667H13.3416" stroke="#1A1F2B" {...common} />
        <Path d="M6.66675 15H6.67508" stroke="#1A1F2B" {...common} />
        <Path d="M10 15H10.0083" stroke="#1A1F2B" {...common} />
        <Path d="M13.3333 15H13.3416" stroke="#1A1F2B" {...common} />
      </Svg>
    );
  }

  if (name === "reportId") {
    return (
      <Svg width={13} height={13} viewBox="0 0 20 20">
        <G>
          <Path d="M3.20825 7.18333C3.08662 6.63544 3.10529 6.0657 3.26255 5.52695C3.4198 4.9882 3.71054 4.49787 4.10781 4.10143C4.50507 3.705 4.99601 3.41529 5.53509 3.25916C6.07417 3.10304 6.64394 3.08555 7.19158 3.20833C7.49301 2.73692 7.90825 2.34897 8.39904 2.08024C8.88983 1.81151 9.44037 1.67065 9.99992 1.67065C10.5595 1.67065 11.11 1.81151 11.6008 2.08024C12.0916 2.34897 12.5068 2.73692 12.8082 3.20833C13.3567 3.08502 13.9275 3.10242 14.4674 3.25893C15.0074 3.41543 15.4989 3.70595 15.8965 4.10346C16.294 4.50097 16.5845 4.99256 16.741 5.5325C16.8975 6.07244 16.9149 6.64319 16.7916 7.19167C17.263 7.49309 17.6509 7.90834 17.9197 8.39912C18.1884 8.88991 18.3293 9.44046 18.3293 10C18.3293 10.5595 18.1884 11.1101 17.9197 11.6009C17.6509 12.0917 17.263 12.5069 16.7916 12.8083C16.9144 13.356 16.8969 13.9257 16.7408 14.4648C16.5846 15.0039 16.2949 15.4948 15.8985 15.8921C15.502 16.2894 15.0117 16.5801 14.473 16.7374C13.9342 16.8946 13.3645 16.9133 12.8166 16.7917C12.5156 17.2649 12.1 17.6545 11.6084 17.9244C11.1167 18.1944 10.5649 18.3359 10.0041 18.3359C9.44323 18.3359 8.89144 18.1944 8.39981 17.9244C7.90818 17.6545 7.49261 17.2649 7.19158 16.7917C6.64394 16.9144 6.07417 16.897 5.53509 16.7408C4.99601 16.5847 4.50507 16.295 4.10781 15.8986C3.71054 15.5021 3.4198 15.0118 3.26255 14.473C3.10529 13.9343 3.08662 13.3646 3.20825 12.8167C2.73321 12.516 2.34193 12.1001 2.07079 11.6077C1.79965 11.1152 1.65747 10.5622 1.65747 10C1.65747 9.43783 1.79965 8.88479 2.07079 8.39232C2.34193 7.89985 2.73321 7.48396 3.20825 7.18333Z" stroke="#1A1F2B" {...common} />
          <Path d="M10 13.3333V10" stroke="#1A1F2B" {...common} />
          <Path d="M10 6.66675H10.0083" stroke="#1A1F2B" {...common} />
        </G>
      </Svg>
    );
  }

  if (name === "trust") {
    return (
      <Svg width={13} height={13} viewBox="0 0 20 20">
        <Path d="M16.6666 10.8333C16.6666 15 13.7499 17.0833 10.2833 18.2916C10.1017 18.3531 9.90453 18.3502 9.72492 18.2833C6.24992 17.0833 3.33325 15 3.33325 10.8333V4.99997C3.33325 4.77895 3.42105 4.56699 3.57733 4.41071C3.73361 4.25443 3.94557 4.16663 4.16659 4.16663C5.83325 4.16663 7.91658 3.16663 9.36658 1.89997C9.54313 1.74913 9.76771 1.66626 9.99992 1.66626C10.2321 1.66626 10.4567 1.74913 10.6333 1.89997C12.0916 3.17497 14.1666 4.16663 15.8333 4.16663C16.0543 4.16663 16.2662 4.25443 16.4225 4.41071C16.5788 4.56699 16.6666 4.77895 16.6666 4.99997V10.8333Z" stroke="#2B7FFF" {...common} />
        <Path d="M7.5 9.99992L9.16667 11.6666L12.5 8.33325" stroke="#2B7FFF" {...common} />
      </Svg>
    );
  }

  if (name === "ranking") {
    return (
      <Svg width={13} height={13} viewBox="0 0 20 20">
        <Path d="M2.5 2.5V15.8333C2.5 16.2754 2.67559 16.6993 2.98816 17.0118C3.30072 17.3244 3.72464 17.5 4.16667 17.5H17.5" stroke="#615FFF" {...common} />
        <Path d="M15 14.1667V7.5" stroke="#615FFF" {...common} />
        <Path d="M10.8333 14.1667V4.16675" stroke="#615FFF" {...common} />
        <Path d="M6.66675 14.1667V11.6667" stroke="#615FFF" {...common} />
      </Svg>
    );
  }

  return (
    <Svg width={13} height={13} viewBox="0 0 20 20">
      <Path d="M18.1083 15.0001L11.4416 3.33344C11.2962 3.07694 11.0854 2.8636 10.8307 2.71516C10.576 2.56673 10.2864 2.48853 9.99161 2.48853C9.69678 2.48853 9.40724 2.56673 9.1525 2.71516C8.89777 2.8636 8.68697 3.07694 8.54161 3.33344L1.87494 15.0001C1.72801 15.2546 1.65096 15.5434 1.65162 15.8372C1.65227 16.131 1.73059 16.4195 1.87865 16.6733C2.0267 16.9271 2.23923 17.1373 2.49469 17.2825C2.75014 17.4277 3.03945 17.5027 3.33327 17.5001H16.6666C16.959 17.4998 17.2462 17.4226 17.4993 17.2762C17.7525 17.1298 17.9626 16.9193 18.1087 16.666C18.2548 16.4127 18.3316 16.1254 18.3316 15.833C18.3315 15.5406 18.2545 15.2533 18.1083 15.0001Z" stroke="#FB2C36" {...common} />
      <Path d="M10 7.5V10.8333" stroke="#FB2C36" {...common} />
      <Path d="M10 14.1667H10.0083" stroke="#FB2C36" {...common} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 26,
    fontSize: 10,
    color: "#1A212B",
    fontFamily: "Helvetica",
    backgroundColor: "#F8F9FA",
  },
  headerCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EEF0F3",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: 700,
    letterSpacing: -0.4,
  },
  beta: {
    marginLeft: 8,
    backgroundColor: "#EFF8D8",
    color: "#8DBB16",
    borderRadius: 4,
    paddingVertical: 3,
    paddingHorizontal: 6,
    fontSize: 8,
    fontWeight: 700,
  },
  pageUrl: {
    color: "#1D73FF",
    fontSize: 11,
    fontWeight: 700,
  },
  urlBox: {
    borderWidth: 1,
    borderColor: "#A5D020",
    backgroundColor: "#FBFFF1",
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  infoGrid: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    overflow: "hidden",
  },
  infoItem: {
    width: "25%",
    padding: 10,
    borderRightWidth: 1,
    borderRightColor: "#E5E7EB",
  },
  infoItemLast: {
    borderRightWidth: 0,
  },
  infoIcon: {
    width: 18,
    height: 18,
    borderRadius: 6,
    backgroundColor: "#EFF6FF",
    marginBottom: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  infoLabel: {
    color: "#8A96A8",
    fontSize: 7.5,
    fontWeight: 700,
    marginBottom: 4,
  },
  infoValue: {
    color: "#1A212B",
    fontSize: 8.5,
    fontWeight: 700,
  },
  bodyText: {
    color: "#4B5563",
    fontSize: 10,
    lineHeight: 1.45,
  },
  scoreRow: {
    flexDirection: "row",
    marginBottom: 18,
  },
  scoreCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 18,
    padding: 13,
    width: "32%",
    minHeight: 112,
    marginRight: 7,
  },
  scoreTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 9,
  },
  scoreIcon: {
    width: 18,
    height: 18,
    borderRadius: 8,
    marginRight: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreLabel: {
    color: "#1A1F2B",
    fontSize: 9,
    fontWeight: 700,
    flex: 1,
  },
  scoreValue: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 8,
    lineHeight: 1.15,
  },
  scoreDesc: {
    color: "#465264",
    fontSize: 8,
    lineHeight: 1.45,
  },
  section: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 20,
    marginBottom: 18,
    overflow: "hidden",
  },
  sectionHeader: {
    backgroundColor: "#F8FAF5",
    borderBottomWidth: 1,
    borderBottomColor: "#EEF0F3",
    paddingVertical: 13,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  sectionAccent: {
    width: 5,
    height: 20,
    borderRadius: 4,
    backgroundColor: "#A5D020",
    marginRight: 10,
  },
  sectionBody: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
  },
  statement: {
    backgroundColor: "#F3F8FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  statementText: {
    color: "#374151",
    fontSize: 11,
    lineHeight: 1.5,
  },
  label: {
    color: "#6B7280",
    fontSize: 9,
    fontWeight: 700,
    marginBottom: 4,
  },
  inlineMetric: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 5,
    marginRight: 6,
  },
  metricLabel: {
    color: "#6B7280",
    fontSize: 10,
    marginRight: 5,
  },
  metricValue: {
    fontSize: 10,
    fontWeight: 700,
  },
  cardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  miniCard: {
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#EEF0F3",
    borderRadius: 12,
    padding: 12,
    width: "48%",
    marginRight: 8,
    marginBottom: 8,
  },
  miniTitle: {
    color: "#4B5563",
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  block: {
    borderWidth: 1,
    borderColor: "#EEF0F3",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  stepCard: {
    borderWidth: 1,
    borderColor: "#E4EDD2",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
  },
  stepHeader: {
    borderWidth: 1,
    borderColor: "#E8F1D6",
    backgroundColor: "#F8FAF2",
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 24,
    backgroundColor: "#A5D020",
    color: "#1A212B",
    fontSize: 10,
    fontWeight: 700,
    textAlign: "center",
    paddingTop: 6,
    marginRight: 9,
  },
  stepEyebrow: {
    color: "#8BAA2B",
    fontSize: 7.5,
    fontWeight: 700,
    marginBottom: 3,
  },
  blockHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  numberBadge: {
    width: 18,
    height: 18,
    borderRadius: 18,
    backgroundColor: "#1D2531",
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: 700,
    textAlign: "center",
    paddingTop: 4,
    marginRight: 8,
  },
  blockTitle: {
    fontSize: 12,
    fontWeight: 700,
  },
  subTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 5,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#EEF0F3",
    marginVertical: 10,
  },
  bullet: {
    flexDirection: "row",
    marginBottom: 5,
  },
  bulletMark: {
    width: 10,
    color: "#8DBB16",
    fontSize: 10,
  },
  redBullet: {
    width: 10,
    color: "#EF4444",
    fontSize: 10,
  },
  tag: {
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontSize: 8.5,
    fontWeight: 700,
  },
  layerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 7,
  },
  footer: {
    position: "absolute",
    bottom: 14,
    left: 28,
    right: 28,
    borderTopWidth: 1,
    borderTopColor: "#E8EAEE",
    paddingTop: 7,
    flexDirection: "row",
    justifyContent: "space-between",
    color: "#9CA3AF",
    fontSize: 8,
  },
});

function getStatusColor(value?: string) {
  return STATUS_COLORS[value || ""] || "#3B82F6";
}

function parseScore(raw: unknown, fallbackLabel: string, fallbackColor: string): ScoreCard {
  if (!raw) return { label: fallbackLabel, value: "-", color: fallbackColor };
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw as Record<string, any>;
    const value = parsed.value || "-";
    return {
      label: parsed.label || fallbackLabel,
      value,
      description: parsed.description || "",
      color: getStatusColor(value) || fallbackColor,
    };
  } catch {
    return { label: fallbackLabel, value: text(raw), color: fallbackColor };
  }
}

function text(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function formatGeneratedAt(report: Report) {
  if (report.generated_at) return report.generated_at;
  if (!report.created_at) return "";
  return new Date(report.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function BulletList({ items, tone = "green" }: { items?: unknown[]; tone?: "green" | "red" | "gray" }) {
  if (!items?.length) return null;
  const markStyle = tone === "red" ? styles.redBullet : styles.bulletMark;
  return (
    <View>
      {items.map((item, index) => (
        <View key={index} style={styles.bullet}>
          <Text style={markStyle}>•</Text>
          <Text style={[styles.bodyText, { flex: 1 }]}>{text(item)}</Text>
        </View>
      ))}
    </View>
  );
}

function Field({ label, value }: { label: string; value: unknown }) {
  if (value == null || value === "") return null;
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.bodyText}>{text(value)}</Text>
    </View>
  );
}

function MiniCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.miniCard}>
      <Text style={styles.miniTitle}>{title}</Text>
      {typeof children === "string" ? <Text style={styles.bodyText}>{children}</Text> : children}
    </View>
  );
}

function NumberedBlock({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.block}>
      <View style={styles.blockHeader}>
        <Text style={styles.numberBadge}>{number}</Text>
        <Text style={styles.blockTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionAccent} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function StepCard({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.stepCard}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepBadge}>{number}</Text>
        <View>
          <Text style={styles.stepEyebrow}>STEP {number}</Text>
          <Text style={styles.blockTitle}>{title}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

function GenericObject({ data }: { data: Record<string, unknown> }) {
  return (
    <View>
      {Object.entries(data).map(([key, value]) => {
        if (value == null || value === "") return null;
        if (Array.isArray(value)) {
          return (
            <View key={key} style={{ marginBottom: 8 }}>
              <Text style={styles.label}>{key.replace(/_/g, " ").toUpperCase()}</Text>
              <BulletList items={value} />
            </View>
          );
        }
        if (typeof value === "object") {
          return (
            <View key={key} style={styles.block}>
              <Text style={styles.blockTitle}>{key.replace(/_/g, " ")}</Text>
              <GenericObject data={value as Record<string, unknown>} />
            </View>
          );
        }
        return <Field key={key} label={key.replace(/_/g, " ")} value={value} />;
      })}
    </View>
  );
}

function Module1({ data }: { data: Record<string, any> }) {
  const metrics = [
    ["Current Status", data.current_status],
    ["Ranking Potential", data.ranking_potential],
    ["Risk Level", data.risk_level],
  ];
  return (
    <Section title="Executive Summary">
      <Field label="Primary Blocking Layer" value={data.primary_blocking_layer} />
      {data.main_conclusion && (
        <View style={styles.statement}>
          <Text style={styles.statementText}>{data.main_conclusion}</Text>
        </View>
      )}
      {metrics.map(([label, value]) => value && (
        <View key={label} style={styles.inlineMetric}>
          <View style={[styles.dot, { backgroundColor: getStatusColor(value) }]} />
          <Text style={styles.metricLabel}>{label}:</Text>
          <Text style={[styles.metricValue, { color: getStatusColor(value) }]}>{value}</Text>
        </View>
      ))}
      <Field label="Explanation" value={data.explanation} />
    </Section>
  );
}

function Module2({ data }: { data: Record<string, any> }) {
  const cards = [
    ["Existing Foundation", data.existing_foundation],
    ["Main Limitation", data.main_limitation],
    ["Likely Search Outcome", data.likely_search_outcome],
    ["Competitive Interpretation", data.competitive_interpretation],
  ];
  return (
    <Section title="Page Level">
      <Field label="Current Assessment" value={data.current_assessment} />
      <View style={styles.cardGrid}>
        {cards.map(([label, value]) => value && (
          <MiniCard key={label} title={label}>{text(value)}</MiniCard>
        ))}
      </View>
    </Section>
  );
}

function Module3({ data }: { data: Record<string, any> }) {
  const failure = data.primary_trust_failure;
  const issues: any[] = data.concrete_issues || [];
  return (
    <Section title="Key Issues">
      <Text style={[styles.bodyText, { marginBottom: 12 }]}>
        Trust builds sequentially. Fixing the wrong layer first will limit the effectiveness of all subsequent work.
      </Text>
      {failure && (
        <NumberedBlock number={1} title="Primary Trust Failure">
          <Field label="Current Main Blockage Layer" value={failure.blocking_layer} />
          <Text style={styles.bodyText}>{text(failure.description)}</Text>
        </NumberedBlock>
      )}
      {issues.length > 0 && (
        <NumberedBlock number={2} title="Concrete Issues">
          {issues.map((issue, index) => (
            <View key={index}>
              <Text style={styles.subTitle}>{index + 1}. {text(issue.title)}</Text>
              <Field label="Judgement" value={issue.judgement} />
              <Field label="Explanation" value={issue.explanation} />
              {issue.impacts?.length > 0 && (
                <View style={{ marginBottom: 7 }}>
                  <Text style={styles.label}>Impacts</Text>
                  <BulletList items={issue.impacts} tone="red" />
                </View>
              )}
              {issue.suggestions?.length > 0 && (
                <View>
                  <Text style={styles.label}>Suggestions</Text>
                  <BulletList items={issue.suggestions} />
                </View>
              )}
              {index < issues.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </NumberedBlock>
      )}
    </Section>
  );
}

function Module4({ data }: { data: Record<string, any> }) {
  const layers: any[] = data.layers || [];
  const visibleLayers = layers
    .map((layer, index) => ({ ...layer, originalIndex: index }))
    .filter((layer) => layer.originalIndex !== 1 && layer.originalIndex !== 2);
  const layerTitles: Record<number, string> = {
    0: "L0-Relevance",
    3: "L1-Entity Clarity",
    4: "L2-Proof Signals",
    5: "L3-Local Fit",
    6: "L4-Strutural Trust",
    7: "L5-Standalone Value",
  };

  return (
    <Section title="Six-Layer Model">
      <Text style={[styles.bodyText, { marginBottom: 12 }]}>
        Below is the full six-layer trust diagnosis used to interpret the current strength of the page.
      </Text>
      <View style={styles.cardGrid}>
        {visibleLayers.map((layer, index) => (
          <View key={index} style={styles.miniCard}>
            <View style={styles.layerHeader}>
              <Text style={[styles.miniTitle, { width: "70%" }]}>
                {layerTitles[layer.originalIndex] || `Layer ${layer.originalIndex + 1}: ${text(layer.layer_name)}`}
              </Text>
              <Text style={[styles.tag, { backgroundColor: "#F5F7FA", color: getStatusColor(layer.status) }]}>
                {text(layer.status)}
              </Text>
            </View>
            <Text style={styles.bodyText}>{text(layer.description)}</Text>
          </View>
        ))}
      </View>
      {visibleLayers.length === 0 && <GenericObject data={data} />}
    </Section>
  );
}

function Module5({ data }: { data: Record<string, any> }) {
  const blocker = data.primary_trust_blocker;
  const mustItems: any[] = data.must_execute_now?.items || [];
  const roadmap: any[] = data.roadmap || [];
  const fixWarning = data.if_fix_order_is_wrong;
  const expect30 = data.what_to_expect_30_days;

  return (
    <Section title="Optimization Path">
      {blocker && (
        <StepCard number={1} title="Primary Trust Blocker">
          <Field label="Current Blocking Layer" value={blocker.blocking_layer} />
          <Field label="Summary" value={blocker.summary} />
          <Text style={styles.label}>Direct Consequences</Text>
          <BulletList items={blocker.direct_consequences} tone="red" />
          <Field label="Why This Layer Cannot Be Skipped" value={blocker.why_cannot_skip} />
        </StepCard>
      )}
      {mustItems.length > 0 && (
        <StepCard number={2} title="Must Execute Now">
          {mustItems.map((item, index) => (
            <View key={index}>
              <Text style={styles.subTitle}>Must Fix {index + 1} - {text(item.title)}</Text>
              <Field label="Why Now" value={item.why_now} />
              <Text style={styles.label}>Execution Focus</Text>
              <BulletList items={item.execution_focus} />
              <Text style={styles.label}>Completion Signals</Text>
              <BulletList items={item.completion_signals} />
              <Text style={styles.label}>Expected Impact</Text>
              <BulletList items={item.expected_impact} />
              {index < mustItems.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </StepCard>
      )}
      {roadmap.length > 0 && (
        <StepCard number={3} title="Roadmap">
          {roadmap.map((phase, index) => (
            <View key={index}>
              <Text style={styles.subTitle}>Phase {index + 1} - {text(phase.phase_title)}</Text>
              <Field label="Entry Condition" value={phase.entry_condition} />
              <Field label="Goal" value={phase.goal} />
              <Text style={styles.label}>Key Actions</Text>
              <BulletList items={phase.key_actions} />
              <Text style={styles.label}>Expected Outcomes</Text>
              <BulletList items={phase.expected_outcomes} />
              {index < roadmap.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </StepCard>
      )}
      {fixWarning && (
        <StepCard number={4} title={text(fixWarning.title) || "If Fix Order Is Wrong"}>
          <Field label="Intro" value={fixWarning.intro} />
          <Field label="Page Specific Risk" value={fixWarning.page_specific_risk} />
          <Field label="Closing Warning" value={fixWarning.closing_warning} />
        </StepCard>
      )}
      {expect30 && (
        <StepCard number={5} title={text(expect30.title) || "What To Expect In The Next 30 Days"}>
          <Field label="Intro" value={expect30.intro} />
          <Text style={styles.label}>Week 1-2</Text>
          <BulletList items={expect30.week_1_2} tone="gray" />
          <Text style={styles.label}>Week 2-3</Text>
          <BulletList items={expect30.week_2_3} tone="gray" />
          <Text style={styles.label}>Week 3-4</Text>
          <BulletList items={expect30.week_3_4} tone="gray" />
          <Text style={styles.label}>End Of 30 Days</Text>
          <BulletList items={expect30.end_of_30_days} tone="gray" />
          <Field label="Closing Note" value={expect30.closing_note} />
        </StepCard>
      )}
    </Section>
  );
}

function ReportSections({ report }: { report: Report }) {
  return (
    <>
      {report.module_1_overview && <Module1 data={report.module_1_overview} />}
      {report.module_2_page_level && <Module2 data={report.module_2_page_level} />}
      {report.module_3_key_problems && <Module3 data={report.module_3_key_problems} />}
      {report.module_4_eight_layers && <Module4 data={report.module_4_eight_layers} />}
      {report.module_5_optimization && <Module5 data={report.module_5_optimization} />}
    </>
  );
}

export function ReportPDFDocument({ report }: { report: Report }) {
  const reportId = report.external_report_id || report.report_id;
  const generatedAt = formatGeneratedAt(report);
  const gbpStatus = report.gbp_connected === true
    ? { value: "Connected", color: "#22C55E" }
    : report.gbp_connected === false
      ? { value: "Disconnected", color: "#EF4444" }
      : { value: "Not checked", color: "#6B7280" };
  const infoItems = [
    { label: "Page Type", value: report.page_type || "Service Page", color: "#3B82F6", icon: "pageType" as const },
    { label: "GBP URL Status", value: gbpStatus.value, color: gbpStatus.color, icon: "gbp" as const },
    { label: "Generated", value: generatedAt || "-", color: "#1A212B", icon: "generated" as const },
    { label: "Report ID", value: reportId, color: "#1A212B", icon: "reportId" as const },
  ];
  const scoreCards = [
    { ...parseScore(report.trust_status, "Trust Status", "#3B82F6"), icon: "trust" as const },
    { ...parseScore(report.ranking_potential, "Ranking Potential", "#8DBB16"), icon: "ranking" as const },
    { ...parseScore(report.risk_level, "Risk Level", "#EF4444"), icon: "risk" as const },
  ];

  return (
    <Document title={`SearchTrust Report ${reportId}`} author="SearchTrust" subject="Trust Audit Report" creator="SearchTrust">
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.headerCard}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Trust Audit Report</Text>
            <Text style={styles.beta}>BETA</Text>
          </View>

          <View style={styles.urlBox}>
            <Text style={styles.pageUrl}>{report.page_url}</Text>
          </View>

          <View style={styles.infoGrid}>
            {infoItems.map((item, index) => (
              <View
                key={item.label}
                style={[
                  styles.infoItem,
                  index === infoItems.length - 1 ? styles.infoItemLast : {},
                ]}
              >
                <View style={[styles.infoIcon, { backgroundColor: index === 1 ? "#ECFDF5" : "#EFF6FF" }]}>
                  <PdfIcon name={item.icon} />
                </View>
                <Text style={styles.infoLabel}>{item.label}</Text>
                <Text style={[styles.infoValue, { color: item.color }]}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.scoreRow}>
          {scoreCards.map((card, index) => (
            <View
              key={card.label}
              style={[
                styles.scoreCard,
                index === scoreCards.length - 1 ? { marginRight: 0 } : {},
              ]}
            >
              <View style={styles.scoreTopRow}>
                <View style={[styles.scoreIcon, { backgroundColor: index === 2 ? "#FEF2F2" : index === 1 ? "#EEF2FF" : "#EFF6FF" }]}>
                  <PdfIcon name={card.icon} />
                </View>
                <Text style={styles.scoreLabel}>{card.label}</Text>
              </View>
              <Text style={[styles.scoreValue, { color: card.color }]}>{card.value}</Text>
              {card.description && <Text style={styles.scoreDesc}>{card.description}</Text>}
            </View>
          ))}
        </View>

        <ReportSections report={report} />

        <View style={styles.footer} fixed>
          <Text>SearchTrust</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
