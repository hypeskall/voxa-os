"use client";

import { useEffect, useRef } from "react";
import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";
import { SiFacebook, SiInstagram, SiTiktok } from "react-icons/si";
import { T, LocalizedElement } from "@/components/locale-provider";

const socials = [
  {
    name: "Facebook",
    href: "https://www.facebook.com/profile.php?id=61561591738334",
    icon: SiFacebook,
  },
  {
    name: "TikTok",
    href: "https://www.tiktok.com/@voxatechro",
    icon: SiTiktok,
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com/voxatechro/",
    icon: SiInstagram,
  },
];

export function MarketingContact() {
  const section = useRef<HTMLElement>(null);

  useEffect(() => {
    // The destination is streamed: align the hash once its section has mounted.
    if (window.location.hash === "#contact") {
      section.current?.scrollIntoView({ behavior: "instant", block: "start" });
    }
  }, []);

  return (
    <section
      ref={section}
      id="contact"
      className="premium-contact"
      aria-labelledby="contact-title"
    >
      <div className="marketing-container marketing-section contact-layout">
        <div className="contact-copy" data-reveal>
          <span className="marketing-eyebrow">
            <T>{"HAI SĂ VORBIM"}</T>
          </span>
          <h2 id="contact-title">
            <T>{"O conversație despre clinica ta."}</T>
          </h2>
          <p>
            <T>
              {
                "Ai întrebări despre Voxa-OS sau vrei să vezi cum se potrivește echipei tale? Suntem aici pentru tine."
              }
            </T>
          </p>
          <LocalizedElement
            as="nav"
            className="contact-socials"
            aria-label="Voxa pe rețelele sociale"
          >
            {socials.map(({ name, href, icon: Icon }) => (
              <a
                key={name}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon size={16} aria-hidden="true" />
                <span>{name}</span>
                <ArrowUpRight size={13} aria-hidden="true" />
              </a>
            ))}
          </LocalizedElement>
        </div>
        <div className="contact-details" data-reveal>
          <h3>
            <T>{"Echipa Suport & Vânzări"}</T>
          </h3>
          <p>
            <T>{"Asistență dedicată clinicilor medicale."}</T>
          </p>
          <dl>
            <div className="contact-detail">
              <Phone size={20} strokeWidth={1.5} aria-hidden="true" />
              <div>
                <dt>
                  <T>{"Telefon"}</T>
                </dt>
                <dd>
                  <a href="tel:+40770541817">
                    +40 770 541 817
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </a>
                </dd>
              </div>
            </div>
            <div className="contact-detail">
              <Mail size={20} strokeWidth={1.5} aria-hidden="true" />
              <div>
                <dt>
                  <T>{"Email"}</T>
                </dt>
                <dd>
                  <a href="mailto:contact@voxatech.ro">
                    contact@voxatech.ro
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </a>
                </dd>
              </div>
            </div>
            <div className="contact-detail">
              <MapPin size={20} strokeWidth={1.5} aria-hidden="true" />
              <div>
                <dt>
                  <T>{"Sediu"}</T>
                </dt>
                <dd>
                  <T>{"Oradea, România"}</T>
                </dd>
              </div>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
