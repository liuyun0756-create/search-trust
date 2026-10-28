import { MethodScope } from "./MethodScope";
import { MethodCaseStudy } from "./MethodCaseStudy";
import { MethodPriorityGuide } from "./MethodPriorityGuide";
import { MethodExecutionGuide } from "./MethodExecutionGuide";
import { MethodDeliveryGuide } from "./MethodDeliveryGuide";
import { MethodIntroduction } from "./MethodIntroduction";
import { MethodConversations } from "./MethodConversations";
import { MethodPipeline } from "./MethodPipeline";
import { MethodSituations } from "./MethodSituations";
import styles from "./method-guide.module.css";

export function MethodGuide() {
  return (
    <div className={styles.guide}>
      <MethodIntroduction />
      <MethodConversations />
      <MethodPipeline />

      <nav className={styles.chapterNav} aria-label="Our Method chapters">
        <div>
          {[
            ["method-scope", "Scope"],
            ["prospect-diagnosis", "Follow a decision"],
            ["prioritization-title", "Set priorities"],
            ["execution-title", "Execute & review"],
            ["delivery-title", "Deliver"],
            ["method-situations", "More situations"],
          ].map(([id, label], index) => (
            <a key={id} href={`#${id}`}>
              <span>0{index + 1}</span>
              {label}
            </a>
          ))}
        </div>
      </nav>

      <MethodScope />

      <MethodCaseStudy />

      <MethodPriorityGuide />

      <MethodExecutionGuide />

      <MethodDeliveryGuide />
      <MethodSituations />
    </div>
  );
}
