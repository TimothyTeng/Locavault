import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Update your store" },
        { name: "description", content: "Update your storage info here" },
    ];
}

export default function UpdateStore() {
    return <div>Update store</div>;
}