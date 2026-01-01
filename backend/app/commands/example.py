"""
PLACEHOLDER EXAMPLE - Example custom command template.

This is a template showing how to create custom CLI commands.
Copy this file and modify it to create your own commands.

This file is intentionally kept as a reference example and can be safely
deleted if not needed.
"""

import click

from app.commands import command, info, success


@command("hello", help="[EXAMPLE] Command that greets the user")
@click.option("--name", "-n", default="World", help="Name to greet")
@click.option("--count", "-c", default=1, type=int, help="Number of greetings")
def hello(name: str, count: int) -> None:
    """
    PLACEHOLDER EXAMPLE - Greet someone multiple times.

    This is an example command demonstrating CLI command structure.
    Copy and modify this for your own commands.

    Example:
        project cmd hello --name Alice --count 3
    """
    info(f"Greeting {name} {count} time(s)...")

    for i in range(count):
        click.echo(f"  [{i + 1}] Hello, {name}!")

    success("Done!")
