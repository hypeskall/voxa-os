"use client";
import { T } from "@/components/locale-provider";
import { useState } from "react";
import { MONTHLY_PRICE, ANNUAL_PRICE } from "./model";

export function PlanPicker({ checkout = false }: { checkout?: boolean }) {
  const [cycle, setCycle] = useState<"monthly" | "annual">("annual");
  return <div className="plan-picker">
    <fieldset className="plan-options">
      <legend><T>{"Alege perioada de facturare"}</T></legend>
      <label><input type="radio" name="billing_cycle" value="monthly" checked={cycle === "monthly"} onChange={() => setCycle("monthly")} /><T>{" Lunar · "}</T>{MONTHLY_PRICE}<T>{" / lună"}</T></label>
      <label><input type="radio" name="billing_cycle" value="annual" checked={cycle === "annual"} onChange={() => setCycle("annual")} /><T>{" Anual · "}</T>{ANNUAL_PRICE}<T>{" / an"}</T></label>
    </fieldset>
    <p className={checkout ? "billing-price" : "pricing-amount"}><strong><T>{cycle === "annual" ? ANNUAL_PRICE : MONTHLY_PRICE}</T></strong><small><T>{cycle === "annual" ? " / an" : " / lună"}</T></small></p>
    <p className="muted"><T>{cycle === "annual" ? "Economisești 89,89 EUR pe an față de plata lunară (37,5%). Plata anuală se achită integral." : "Plată lunară, cu anulare la finalul perioadei plătite."}</T></p>
  </div>;
}
