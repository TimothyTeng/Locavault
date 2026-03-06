import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Stores" },
        { name: "description", content: "See all your stores here." },
    ];
}

export default function Store() {
    return <div>Store</div>;
}