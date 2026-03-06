import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Add Store" },
        { name: "description", content: "Add a new location" },
    ];
}

export default function AddStore() {
    return <div>AddStore</div>;
}